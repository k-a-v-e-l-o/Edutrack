const { query } = require('../db');

// ─── Dashboard Stats ──────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const parentId = req.user.id;

    const [children, messages, notifications, fees] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total FROM parent_learners WHERE parent_id = $1`,
        [parentId]
      ),
      query(
        `SELECT COUNT(*) AS unread FROM messages
         WHERE recipient_id = $1 AND is_read = FALSE`,
        [parentId]
      ),
      query(
        `SELECT COUNT(*) AS unread FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [parentId]
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE fa.status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE fa.status = 'overdue') AS overdue,
           COALESCE(SUM(fa.amount_due - fa.amount_paid), 0) AS total_outstanding
         FROM fee_accounts fa
         JOIN parent_learners pl ON pl.learner_id = fa.learner_id
         WHERE pl.parent_id = $1`,
        [parentId]
      )
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total_children:       children.rows[0].total,
        unread_messages:      messages.rows[0].unread,
        unread_notifications: notifications.rows[0].unread,
        fees:                 fees.rows[0]
      }
    });
  } catch (err) {
    console.error('Parent getDashboardStats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Get Children ─────────────────────────────────────────────
const getChildren = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.profile_photo,
         pl.relationship, pl.is_primary,
         lp.student_number, lp.enrollment_date,
         c.name AS class_name,
         g.name AS grade_name
       FROM parent_learners pl
       JOIN users u              ON u.id  = pl.learner_id
       JOIN learner_profiles lp  ON lp.user_id = pl.learner_id
       JOIN classes c            ON c.id  = lp.class_id
       JOIN grades g             ON g.id  = c.grade_id
       WHERE pl.parent_id = $1`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, children: result.rows });
  } catch (err) {
    console.error('Parent getChildren error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Helper: verify child belongs to parent ───────────────────
const verifyChild = async (parentId, childId) => {
  const result = await query(
    `SELECT 1 FROM parent_learners WHERE parent_id = $1 AND learner_id = $2`,
    [parentId, childId]
  );
  return result.rows.length > 0;
};

// ─── Child Grades ─────────────────────────────────────────────
const getChildGrades = async (req, res) => {
  try {
    const { id: childId } = req.params;

    if (!(await verifyChild(req.user.id, childId)))
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `SELECT
         a.title, a.term, a.total_marks, a.date,
         at.name AS assessment_type,
         s.name  AS subject,
         m.marks_obtained,
         ROUND(m.marks_obtained / a.total_marks * 100, 2) AS percentage,
         m.comment
       FROM marks m
       JOIN assessments a      ON a.id  = m.assessment_id
       JOIN assessment_types at ON at.id = a.assessment_type_id
       JOIN class_subjects cs  ON cs.id = a.class_subject_id
       JOIN subjects s         ON s.id  = cs.subject_id
       WHERE m.learner_id = $1
       ORDER BY a.date DESC`,
      [childId]
    );
    return res.status(200).json({ success: true, grades: result.rows });
  } catch (err) {
    console.error('Parent getChildGrades error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Child Attendance ─────────────────────────────────────────
const getChildAttendance = async (req, res) => {
  try {
    const { id: childId } = req.params;

    if (!(await verifyChild(req.user.id, childId)))
      return res.status(403).json({ success: false, message: 'Access denied.' });

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
      [childId]
    );
    return res.status(200).json({ success: true, attendance: result.rows });
  } catch (err) {
    console.error('Parent getChildAttendance error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Child Timetable ──────────────────────────────────────────
const getChildTimetable = async (req, res) => {
  try {
    const { id: childId } = req.params;

    if (!(await verifyChild(req.user.id, childId)))
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const result = await query(
      `SELECT
         ts.day_of_week, ts.period_number, ts.start_time, ts.end_time,
         s.name AS subject,
         u.first_name || ' ' || u.last_name AS teacher
       FROM timetable_slots ts
       JOIN class_subjects cs  ON cs.id = ts.class_subject_id
       JOIN subjects s         ON s.id  = cs.subject_id
       JOIN users u            ON u.id  = cs.teacher_id
       JOIN learner_profiles lp ON lp.class_id = cs.class_id
       WHERE lp.user_id = $1
       ORDER BY ts.day_of_week, ts.period_number`,
      [childId]
    );
    return res.status(200).json({ success: true, timetable: result.rows });
  } catch (err) {
    console.error('Parent getChildTimetable error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Fees ─────────────────────────────────────────────────────
const getFees = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         fa.id, fa.amount_due, fa.amount_paid, fa.status, fa.due_date,
         fa.amount_due - fa.amount_paid AS balance,
         fs.name AS fee_name, fs.year, fs.term,
         u.first_name || ' ' || u.last_name AS learner_name,
         lp.student_number
       FROM fee_accounts fa
       JOIN fee_structures fs  ON fs.id = fa.fee_structure_id
       JOIN parent_learners pl ON pl.learner_id = fa.learner_id
       JOIN users u            ON u.id = fa.learner_id
       JOIN learner_profiles lp ON lp.user_id = fa.learner_id
       WHERE pl.parent_id = $1
       ORDER BY fa.due_date DESC`,
      [req.user.id]
    );
    return res.status(200).json({ success: true, fees: result.rows });
  } catch (err) {
    console.error('Parent getFees error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Make Payment ─────────────────────────────────────────────
const makePayment = async (req, res) => {
  try {
    const { id: feeAccountId } = req.params;
    const { amount, method, reference, notes } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });

    // Verify fee account belongs to parent's child
    const feeAccount = await query(
      `SELECT fa.id, fa.amount_due, fa.amount_paid, fa.status, fa.learner_id
       FROM fee_accounts fa
       JOIN parent_learners pl ON pl.learner_id = fa.learner_id
       WHERE fa.id = $1 AND pl.parent_id = $2`,
      [feeAccountId, req.user.id]
    );

    if (!feeAccount.rows[0])
      return res.status(404).json({ success: false, message: 'Fee account not found.' });

    const fee = feeAccount.rows[0];

    if (fee.status === 'paid')
      return res.status(400).json({ success: false, message: 'This fee has already been paid.' });

    // Record payment
    await query(
      `INSERT INTO payments (fee_account_id, amount, method, reference, recorded_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [feeAccountId, amount, method || null, reference || null, req.user.id, notes || null]
    );

    // Update fee account
    const newAmountPaid = parseFloat(fee.amount_paid) + parseFloat(amount);
    const newStatus = newAmountPaid >= parseFloat(fee.amount_due) ? 'paid' : 'pending';

    await query(
      `UPDATE fee_accounts SET amount_paid = $1, status = $2 WHERE id = $3`,
      [newAmountPaid, newStatus, feeAccountId]
    );

    return res.status(201).json({ success: true, message: 'Payment recorded successfully.' });
  } catch (err) {
    console.error('Parent makePayment error:', err.message);
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
         AND 'parent' = ANY(a.audience)
       ORDER BY a.published_at DESC`,
      [req.user.id]
    );

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
    console.error('Parent getAnnouncements error:', err.message);
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
    console.error('Parent getMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipient_id, subject, body } = req.body;

    if (!recipient_id || !body)
      return res.status(400).json({ success: false, message: 'Recipient and body are required.' });

    // Parents can only message teachers
    const recipient = await query(
      `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
      [recipient_id]
    );

    if (!recipient.rows[0])
      return res.status(404).json({ success: false, message: 'Recipient not found.' });

    if (recipient.rows[0].role !== 'teacher')
      return res.status(403).json({ success: false, message: 'Parents can only message teachers.' });

    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, body)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, recipient_id, subject || null, body]
    );

    return res.status(201).json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error('Parent sendMessage error:', err.message);
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
    console.error('Parent getNotifications error:', err.message);
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
    console.error('Parent markNotificationRead error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getDashboardStats,
  getChildren,
  getChildGrades,
  getChildAttendance,
  getChildTimetable,
  getFees,
  makePayment,
  getAnnouncements,
  getMessages,
  sendMessage,
  getNotifications,
  markNotificationRead
};