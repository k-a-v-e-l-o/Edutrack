const { query } = require('../db');

// ─── Dashboard Stats ──────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const learnerId = req.user.id;

    const [attendance, marks, resources, messages, notifications] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'present') AS present,
           COUNT(*) FILTER (WHERE status = 'absent')  AS absent,
           COUNT(*) FILTER (WHERE status = 'late')    AS late,
           COUNT(*)                                   AS total
         FROM attendance WHERE learner_id = $1`,
        [learnerId]
      ),
      query(
        `SELECT ROUND(AVG(marks_obtained / a.total_marks * 100), 2) AS average
         FROM marks m
         JOIN assessments a ON a.id = m.assessment_id
         WHERE m.learner_id = $1`,
        [learnerId]
      ),
      query(
        `SELECT COUNT(*) AS total
         FROM resources r
         JOIN class_subjects cs ON cs.id = r.class_subject_id
         JOIN learner_profiles lp ON lp.class_id = cs.class_id
         WHERE lp.user_id = $1`,
        [learnerId]
      ),
      query(
        `SELECT COUNT(*) AS unread FROM messages
         WHERE recipient_id = $1 AND is_read = FALSE`,
        [learnerId]
      ),
      query(
        `SELECT COUNT(*) AS unread FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [learnerId]
      )
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        attendance:        attendance.rows[0],
        average_mark:      marks.rows[0].average || 0,
        total_resources:   resources.rows[0].total,
        unread_messages:   messages.rows[0].unread,
        unread_notifications: notifications.rows[0].unread
      }
    });
  } catch (err) {
    console.error('Learner getDashboardStats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Grades ───────────────────────────────────────────────────
const getGrades = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         a.title, a.term, a.total_marks, a.date,
         at.name AS assessment_type,
         s.name  AS subject,
         m.marks_obtained,
         ROUND(m.marks_obtained / a.total_marks * 100, 2) AS percentage,
         m.comment
       FROM marks m
       JOIN assessments a   ON a.id = m.assessment_id
       JOIN assessment_types at ON at.id = a.assessment_type_id
       JOIN class_subjects cs  ON cs.id = a.class_subject_id
       JOIN subjects s         ON s.id  = cs.subject_id
       WHERE m.learner_id = $1
       ORDER BY a.date DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, grades: result.rows });
  } catch (err) {
    console.error('Learner getGrades error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Attendance ───────────────────────────────────────────────
const getAttendance = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         a.date, a.status, a.note,
         s.name AS subject,
         u.first_name || ' ' || u.last_name AS marked_by
       FROM attendance a
       JOIN class_subjects cs ON cs.id = a.class_subject_id
       JOIN subjects s        ON s.id  = cs.subject_id
       JOIN users u           ON u.id  = a.marked_by
       WHERE a.learner_id = $1
       ORDER BY a.date DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, attendance: result.rows });
  } catch (err) {
    console.error('Learner getAttendance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Timetable ────────────────────────────────────────────────
const getTimetable = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         ts.day_of_week, ts.period_number, ts.start_time, ts.end_time,
         s.name  AS subject,
         u.first_name || ' ' || u.last_name AS teacher
       FROM timetable_slots ts
       JOIN class_subjects cs ON cs.id = ts.class_subject_id
       JOIN subjects s        ON s.id  = cs.subject_id
       JOIN users u           ON u.id  = cs.teacher_id
       JOIN learner_profiles lp ON lp.class_id = cs.class_id
       WHERE lp.user_id = $1
       ORDER BY ts.day_of_week, ts.period_number`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, timetable: result.rows });
  } catch (err) {
    console.error('Learner getTimetable error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Resources ────────────────────────────────────────────────
const getResources = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         r.id, r.title, r.description, r.type, r.url, r.created_at,
         s.name AS subject,
         u.first_name || ' ' || u.last_name AS uploaded_by
       FROM resources r
       JOIN class_subjects cs  ON cs.id = r.class_subject_id
       JOIN subjects s         ON s.id  = cs.subject_id
       JOIN users u            ON u.id  = r.uploaded_by
       JOIN learner_profiles lp ON lp.class_id = cs.class_id
       WHERE lp.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, resources: result.rows });
  } catch (err) {
    console.error('Learner getResources error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Announcements ────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         a.id, a.title, a.body, a.published_at,
         u.first_name || ' ' || u.last_name AS published_by,
         EXISTS (
           SELECT 1 FROM announcement_views av
           WHERE av.announcement_id = a.id AND av.user_id = $1
         ) AS is_read
       FROM announcements a
       JOIN users u ON u.id = a.published_by
       WHERE a.status = 'published'
         AND 'learner' = ANY(a.audience)
       ORDER BY a.published_at DESC`,
      [req.user.id]
    );

    // Mark all as viewed
    for (const row of result.rows) {
      if (!row.is_read) {
        await query(
          `INSERT INTO announcement_views (announcement_id, user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.id, req.user.id]
        );
      }
    }

    return res.status(200).json({ success: true, announcements: result.rows });
  } catch (err) {
    console.error('Learner getAnnouncements error:', err.message);
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
    console.error('Learner getMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipient_id, subject, body } = req.body;

    if (!recipient_id || !body)
      return res.status(400).json({ success: false, message: 'Recipient and body are required.' });

    // Learners can only message teachers
    const recipient = await query(
      `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
      [recipient_id]
    );

    if (!recipient.rows[0])
      return res.status(404).json({ success: false, message: 'Recipient not found.' });

    if (recipient.rows[0].role !== 'teacher')
      return res.status(403).json({ success: false, message: 'Learners can only message teachers.' });

    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, body)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, recipient_id, subject || null, body]
    );

    return res.status(201).json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error('Learner sendMessage error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Notifications ────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, title, body, type, is_read, link, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, notifications: result.rows });
  } catch (err) {
    console.error('Learner getNotifications error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Learner markNotificationRead error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getDashboardStats,
  getGrades,
  getAttendance,
  getTimetable,
  getResources,
  getAnnouncements,
  getMessages,
  sendMessage,
  getNotifications,
  markNotificationRead
};