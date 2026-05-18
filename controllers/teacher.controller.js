const { query } = require('../db');

// ─── Dashboard Stats ──────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const [classes, learners, assessments, messages, notifications] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM class_subjects WHERE teacher_id = $1`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(DISTINCT lp.user_id) AS total
         FROM learner_profiles lp
         JOIN class_subjects cs ON cs.class_id = lp.class_id
         WHERE cs.teacher_id = $1`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(*) AS total FROM assessments a
         JOIN class_subjects cs ON cs.id = a.class_subject_id
         WHERE cs.teacher_id = $1`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(*) AS unread FROM messages
         WHERE recipient_id = $1 AND is_read = FALSE`,
        [teacherId]
      ),
      query(
        `SELECT COUNT(*) AS unread FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [teacherId]
      )
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total_classes:        classes.rows[0].total,
        total_learners:       learners.rows[0].total,
        total_assessments:    assessments.rows[0].total,
        unread_messages:      messages.rows[0].unread,
        unread_notifications: notifications.rows[0].unread
      }
    });
  } catch (err) {
    console.error('Teacher getDashboardStats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Classes ──────────────────────────────────────────────
const getClasses = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         cs.id AS class_subject_id,
         c.id AS class_id, c.name AS class_name, c.room,
         s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
         g.name AS grade_name,
         COUNT(lp.user_id) AS learner_count
       FROM class_subjects cs
       JOIN classes c  ON c.id = cs.class_id
       JOIN subjects s ON s.id = cs.subject_id
       JOIN grades g   ON g.id = c.grade_id
       LEFT JOIN learner_profiles lp ON lp.class_id = c.id
       WHERE cs.teacher_id = $1
       GROUP BY cs.id, c.id, s.id, g.name
       ORDER BY c.name, s.name`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, classes: result.rows });
  } catch (err) {
    console.error('Teacher getClasses error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Class Learners ───────────────────────────────────────
const getClassLearners = async (req, res) => {
  try {
    const { id: classSubjectId } = req.params;

    // Verify teacher owns this class_subject
    const check = await query(
      `SELECT 1 FROM class_subjects WHERE id = $1 AND teacher_id = $2`,
      [classSubjectId, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.profile_photo,
         lp.student_number, lp.enrollment_date
       FROM learner_profiles lp
       JOIN users u ON u.id = lp.user_id
       JOIN class_subjects cs ON cs.class_id = lp.class_id
       WHERE cs.id = $1
       ORDER BY u.last_name, u.first_name`,
      [classSubjectId]
    );
    return res.status(200).json({ success: true, learners: result.rows });
  } catch (err) {
    console.error('Teacher getClassLearners error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Mark Attendance ──────────────────────────────────────────
const markAttendance = async (req, res) => {
  try {
    const { class_subject_id, date, records } = req.body;
    // records = [{ learner_id, status, note }]

    if (!class_subject_id || !date || !records || !records.length)
      return res.status(400).json({ success: false, message: 'class_subject_id, date and records are required.' });

    // Verify teacher owns this class_subject
    const check = await query(
      `SELECT 1 FROM class_subjects WHERE id = $1 AND teacher_id = $2`,
      [class_subject_id, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    for (const record of records) {
      await query(
        `INSERT INTO attendance (learner_id, class_subject_id, date, status, note, marked_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (learner_id, class_subject_id, date)
         DO UPDATE SET status = $4, note = $5`,
        [record.learner_id, class_subject_id, date, record.status || 'present', record.note || null, req.user.id]
      );
    }

    return res.status(201).json({ success: true, message: 'Attendance marked successfully.' });
  } catch (err) {
    console.error('Teacher markAttendance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Attendance ───────────────────────────────────────────
const getAttendance = async (req, res) => {
  try {
    const { classSubjectId } = req.params;
    const { date } = req.query;

    const check = await query(
      `SELECT 1 FROM class_subjects WHERE id = $1 AND teacher_id = $2`,
      [classSubjectId, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    let sql = `
      SELECT
        a.id, a.date, a.status, a.note,
        u.id AS learner_id,
        u.first_name || ' ' || u.last_name AS learner_name,
        lp.student_number
      FROM attendance a
      JOIN users u ON u.id = a.learner_id
      JOIN learner_profiles lp ON lp.user_id = u.id
      WHERE a.class_subject_id = $1
    `;
    const params = [classSubjectId];

    if (date) {
      sql += ` AND a.date = $2`;
      params.push(date);
    }

    sql += ` ORDER BY a.date DESC, u.last_name`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, attendance: result.rows });
  } catch (err) {
    console.error('Teacher getAttendance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Assessments ──────────────────────────────────────────
const getAssessments = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         a.id, a.title, a.term, a.total_marks, a.date,
         at.name AS assessment_type,
         s.name  AS subject,
         c.name  AS class_name
       FROM assessments a
       JOIN assessment_types at ON at.id = a.assessment_type_id
       JOIN class_subjects cs   ON cs.id = a.class_subject_id
       JOIN subjects s          ON s.id  = cs.subject_id
       JOIN classes c           ON c.id  = cs.class_id
       WHERE cs.teacher_id = $1
       ORDER BY a.date DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, assessments: result.rows });
  } catch (err) {
    console.error('Teacher getAssessments error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Create Assessment ────────────────────────────────────────
const createAssessment = async (req, res) => {
  try {
    const { class_subject_id, assessment_type_id, term, title, total_marks, date } = req.body;

    if (!class_subject_id || !assessment_type_id || !term || !title || !total_marks)
      return res.status(400).json({ success: false, message: 'All fields are required.' });

    const check = await query(
      `SELECT 1 FROM class_subjects WHERE id = $1 AND teacher_id = $2`,
      [class_subject_id, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `INSERT INTO assessments (class_subject_id, assessment_type_id, term, title, total_marks, date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [class_subject_id, assessment_type_id, term, title, total_marks, date || null, req.user.id]
    );

    return res.status(201).json({ success: true, assessment: result.rows[0] });
  } catch (err) {
    console.error('Teacher createAssessment error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Update Assessment ────────────────────────────────────────
const updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, total_marks, date, term } = req.body;

    const check = await query(
      `SELECT 1 FROM assessments a
       JOIN class_subjects cs ON cs.id = a.class_subject_id
       WHERE a.id = $1 AND cs.teacher_id = $2`,
      [id, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `UPDATE assessments SET title = $1, total_marks = $2, date = $3, term = $4
       WHERE id = $5 RETURNING *`,
      [title, total_marks, date, term, id]
    );
    return res.status(200).json({ success: true, assessment: result.rows[0] });
  } catch (err) {
    console.error('Teacher updateAssessment error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Marks ────────────────────────────────────────────────
const getMarks = async (req, res) => {
  try {
    const { id: assessmentId } = req.params;

    const check = await query(
      `SELECT 1 FROM assessments a
       JOIN class_subjects cs ON cs.id = a.class_subject_id
       WHERE a.id = $1 AND cs.teacher_id = $2`,
      [assessmentId, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `SELECT
         m.id, m.marks_obtained, m.comment,
         u.id AS learner_id,
         u.first_name || ' ' || u.last_name AS learner_name,
         lp.student_number,
         ROUND(m.marks_obtained / a.total_marks * 100, 2) AS percentage
       FROM marks m
       JOIN users u            ON u.id  = m.learner_id
       JOIN learner_profiles lp ON lp.user_id = u.id
       JOIN assessments a      ON a.id  = m.assessment_id
       WHERE m.assessment_id = $1
       ORDER BY u.last_name`,
      [assessmentId]
    );
    return res.status(200).json({ success: true, marks: result.rows });
  } catch (err) {
    console.error('Teacher getMarks error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Submit Marks ─────────────────────────────────────────────
const submitMarks = async (req, res) => {
  try {
    const { id: assessmentId } = req.params;
    const { marks } = req.body;
    // marks = [{ learner_id, marks_obtained, comment }]

    if (!marks || !marks.length)
      return res.status(400).json({ success: false, message: 'Marks array is required.' });

    const check = await query(
      `SELECT 1 FROM assessments a
       JOIN class_subjects cs ON cs.id = a.class_subject_id
       WHERE a.id = $1 AND cs.teacher_id = $2`,
      [assessmentId, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    for (const mark of marks) {
      await query(
        `INSERT INTO marks (assessment_id, learner_id, marks_obtained, comment, entered_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (assessment_id, learner_id)
         DO UPDATE SET marks_obtained = $3, comment = $4`,
        [assessmentId, mark.learner_id, mark.marks_obtained, mark.comment || null, req.user.id]
      );
    }

    return res.status(201).json({ success: true, message: 'Marks submitted successfully.' });
  } catch (err) {
    console.error('Teacher submitMarks error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Resources ────────────────────────────────────────────
const getResources = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         r.id, r.title, r.description, r.type, r.url, r.created_at,
         s.name AS subject,
         c.name AS class_name
       FROM resources r
       JOIN class_subjects cs ON cs.id = r.class_subject_id
       JOIN subjects s        ON s.id  = cs.subject_id
       JOIN classes c         ON c.id  = cs.class_id
       WHERE cs.teacher_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, resources: result.rows });
  } catch (err) {
    console.error('Teacher getResources error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Upload Resource ──────────────────────────────────────────
const uploadResource = async (req, res) => {
  try {
    const { class_subject_id, title, description, type, url } = req.body;

    if (!class_subject_id || !title || !url)
      return res.status(400).json({ success: false, message: 'class_subject_id, title and url are required.' });

    const check = await query(
      `SELECT 1 FROM class_subjects WHERE id = $1 AND teacher_id = $2`,
      [class_subject_id, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `INSERT INTO resources (class_subject_id, title, description, type, url, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [class_subject_id, title, description || null, type || 'document', url, req.user.id]
    );
    return res.status(201).json({ success: true, resource: result.rows[0] });
  } catch (err) {
    console.error('Teacher uploadResource error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Delete Resource ──────────────────────────────────────────
const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;

    const check = await query(
      `SELECT 1 FROM resources r
       JOIN class_subjects cs ON cs.id = r.class_subject_id
       WHERE r.id = $1 AND cs.teacher_id = $2`,
      [id, req.user.id]
    );
    if (!check.rows[0])
      return res.status(403).json({ success: false, message: 'Access denied.' });

    await query(`DELETE FROM resources WHERE id = $1`, [id]);
    return res.status(200).json({ success: true, message: 'Resource deleted.' });
  } catch (err) {
    console.error('Teacher deleteResource error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Messages ─────────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         m.id, m.subject, m.body, m.is_read, m.read_at, m.created_at,
         u.first_name || ' ' || u.last_name AS sender,
         u.role AS sender_role
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.recipient_id = $1
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, messages: result.rows });
  } catch (err) {
    console.error('Teacher getMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipient_id, subject, body } = req.body;

    if (!recipient_id || !body)
      return res.status(400).json({ success: false, message: 'Recipient and body are required.' });

    // Teachers can message learners, parents and admin
    const recipient = await query(
      `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
      [recipient_id]
    );

    if (!recipient.rows[0])
      return res.status(404).json({ success: false, message: 'Recipient not found.' });

    const allowed = ['learner', 'parent', 'admin'];
    if (!allowed.includes(recipient.rows[0].role))
      return res.status(403).json({ success: false, message: 'Teachers can only message learners, parents or admin.' });

    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, body)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, recipient_id, subject || null, body]
    );

    return res.status(201).json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error('Teacher sendMessage error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Notifications ────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, body, type, is_read, link, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, notifications: result.rows });
  } catch (err) {
    console.error('Teacher getNotifications error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Teacher markNotificationRead error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getDashboardStats,
  getClasses,
  getClassLearners,
  markAttendance,
  getAttendance,
  getAssessments,
  createAssessment,
  updateAssessment,
  getMarks,
  submitMarks,
  getResources,
  uploadResource,
  deleteResource,
  getMessages,
  sendMessage,
  getNotifications,
  markNotificationRead
};