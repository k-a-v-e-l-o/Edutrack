const { query } = require('../db');
const bcrypt    = require('bcryptjs');
const { getMetrics: collectMetrics, getMetricsJson: collectMetricsJson } = require('../middleware/monitoring');

// ─── Dashboard Stats ──────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [users, learners, teachers, parents, fees, announcements] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE`),
      query(`SELECT COUNT(*) AS total FROM users WHERE role = 'learner' AND is_active = TRUE`),
      query(`SELECT COUNT(*) AS total FROM users WHERE role = 'teacher' AND is_active = TRUE`),
      query(`SELECT COUNT(*) AS total FROM users WHERE role = 'parent' AND is_active = TRUE`),
      query(
        `SELECT
           COALESCE(SUM(amount_due), 0)                                    AS total_due,
           COALESCE(SUM(amount_paid), 0)                                   AS total_paid,
           COALESCE(SUM(amount_due - amount_paid), 0)                      AS total_outstanding,
           COUNT(*) FILTER (WHERE status = 'overdue')                      AS overdue_count
         FROM fee_accounts`
      ),
      query(
        `SELECT COUNT(*) AS total FROM announcements WHERE status = 'published'`
      )
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total_users:        users.rows[0].total,
        total_learners:     learners.rows[0].total,
        total_teachers:     teachers.rows[0].total,
        total_parents:      parents.rows[0].total,
        fees:               fees.rows[0],
        total_announcements: announcements.rows[0].total
      }
    });
  } catch (err) {
    console.error('Admin getDashboardStats error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Users ────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    let sql = `
      SELECT id, email, role, first_name, last_name, phone,
             gender, is_active, last_login, created_at
      FROM users WHERE 1=1
    `;
    const params = [];

    if (role) {
      params.push(role);
      sql += ` AND role = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Admin getUsers error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getUserById = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, role, first_name, last_name, phone,
              gender, date_of_birth, profile_photo, is_active, last_login, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'User not found.' });

    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Admin getUserById error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createUser = async (req, res) => {
  try {
    const {
      email, password, role, first_name, last_name,
      phone, gender, date_of_birth,
      // learner extras
      student_number, class_id, enrollment_date,
      // teacher extras
      employee_number, qualification, specialization, join_date,
      // parent extras
      occupation
    } = req.body;

    if (!email || !password || !role || !first_name || !last_name)
      return res.status(400).json({ success: false, message: 'Email, password, role, first and last name are required.' });

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows[0])
      return res.status(409).json({ success: false, message: 'Email already in use.' });

    const password_hash = await bcrypt.hash(password, 12);

    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, gender, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, role, first_name, last_name`,
      [email.toLowerCase().trim(), password_hash, role, first_name, last_name, phone || null, gender || null, date_of_birth || null]
    );

    const newUser = userResult.rows[0];

    // Create role profile
    if (role === 'learner') {
      if (!student_number || !class_id)
        return res.status(400).json({ success: false, message: 'student_number and class_id are required for learners.' });
      await query(
        `INSERT INTO learner_profiles (user_id, student_number, class_id, enrollment_date)
         VALUES ($1, $2, $3, $4)`,
        [newUser.id, student_number, class_id, enrollment_date || new Date()]
      );
    } else if (role === 'teacher') {
      if (!employee_number)
        return res.status(400).json({ success: false, message: 'employee_number is required for teachers.' });
      await query(
        `INSERT INTO teacher_profiles (user_id, employee_number, qualification, specialization, join_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [newUser.id, employee_number, qualification || null, specialization || null, join_date || new Date()]
      );
    } else if (role === 'parent') {
      await query(
        `INSERT INTO parent_profiles (user_id, occupation) VALUES ($1, $2)`,
        [newUser.id, occupation || null]
      );
    }

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, user_name, role, action, ip_address, status)
       VALUES ($1, $2, $3, $4, $5, 'success')`,
      [req.user.id, req.user.email, req.user.role, `CREATE_USER:${role.toUpperCase()}`, req.ip]
    );

    return res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error('Admin createUser error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, gender, date_of_birth, is_active } = req.body;

    const result = await query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name  = COALESCE($2, last_name),
           phone      = COALESCE($3, phone),
           gender     = COALESCE($4, gender),
           date_of_birth = COALESCE($5, date_of_birth),
           is_active  = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING id, email, role, first_name, last_name, is_active`,
      [first_name, last_name, phone, gender, date_of_birth, is_active, id]
    );

    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'User not found.' });

    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Admin updateUser error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id)
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });

    const result = await query(
      `UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'User not found.' });

    return res.status(200).json({ success: true, message: 'User deactivated successfully.' });
  } catch (err) {
    console.error('Admin deleteUser error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Classes ──────────────────────────────────────────────────
const getClasses = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         c.id, c.name, c.room, c.capacity, c.created_at,
         g.name AS grade_name,
         COUNT(lp.user_id) AS learner_count
       FROM classes c
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN learner_profiles lp ON lp.class_id = c.id
       GROUP BY c.id, g.name
       ORDER BY g.level, c.name`
    );
    return res.status(200).json({ success: true, classes: result.rows });
  } catch (err) {
    console.error('Admin getClasses error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createClass = async (req, res) => {
  try {
    const { name, grade_id, room, capacity } = req.body;
    if (!name || !grade_id)
      return res.status(400).json({ success: false, message: 'Name and grade_id are required.' });

    const result = await query(
      `INSERT INTO classes (name, grade_id, room, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, grade_id, room || null, capacity || 40]
    );
    return res.status(201).json({ success: true, class: result.rows[0] });
  } catch (err) {
    console.error('Admin createClass error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, room, capacity } = req.body;

    const result = await query(
      `UPDATE classes SET name = COALESCE($1, name), room = COALESCE($2, room),
       capacity = COALESCE($3, capacity) WHERE id = $4 RETURNING *`,
      [name, room, capacity, id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Class not found.' });

    return res.status(200).json({ success: true, class: result.rows[0] });
  } catch (err) {
    console.error('Admin updateClass error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteClass = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM classes WHERE id = $1 RETURNING id`, [req.params.id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Class not found.' });

    return res.status(200).json({ success: true, message: 'Class deleted.' });
  } catch (err) {
    console.error('Admin deleteClass error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Subjects ─────────────────────────────────────────────────
const getSubjects = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM subjects ORDER BY name`);
    return res.status(200).json({ success: true, subjects: result.rows });
  } catch (err) {
    console.error('Admin getSubjects error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code)
      return res.status(400).json({ success: false, message: 'Name and code are required.' });

    const result = await query(
      `INSERT INTO subjects (name, code, description) VALUES ($1, $2, $3) RETURNING *`,
      [name, code, description || null]
    );
    return res.status(201).json({ success: true, subject: result.rows[0] });
  } catch (err) {
    console.error('Admin createSubject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const result = await query(
      `UPDATE subjects SET name = COALESCE($1, name), code = COALESCE($2, code),
       description = COALESCE($3, description) WHERE id = $4 RETURNING *`,
      [name, code, description, id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Subject not found.' });

    return res.status(200).json({ success: true, subject: result.rows[0] });
  } catch (err) {
    console.error('Admin updateSubject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM subjects WHERE id = $1 RETURNING id`, [req.params.id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Subject not found.' });

    return res.status(200).json({ success: true, message: 'Subject deleted.' });
  } catch (err) {
    console.error('Admin deleteSubject error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Announcements ────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         a.id, a.title, a.body, a.audience, a.status, a.published_at, a.created_at,
         u.first_name || ' ' || u.last_name AS published_by
       FROM announcements a
       JOIN users u ON u.id = a.published_by
       ORDER BY a.created_at DESC`
    );
    return res.status(200).json({ success: true, announcements: result.rows });
  } catch (err) {
    console.error('Admin getAnnouncements error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, audience, status } = req.body;
    if (!title || !body)
      return res.status(400).json({ success: false, message: 'Title and body are required.' });

    const publishedAt = status === 'published' ? new Date() : null;

    const result = await query(
      `INSERT INTO announcements (title, body, audience, status, published_by, published_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, body, audience || ['learner', 'parent'], status || 'draft', req.user.id, publishedAt]
    );
    return res.status(201).json({ success: true, announcement: result.rows[0] });
  } catch (err) {
    console.error('Admin createAnnouncement error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, audience, status } = req.body;

    const publishedAt = status === 'published' ? new Date() : null;

    const result = await query(
      `UPDATE announcements
       SET title = COALESCE($1, title),
           body  = COALESCE($2, body),
           audience = COALESCE($3, audience),
           status = COALESCE($4, status),
           published_at = COALESCE($5, published_at)
       WHERE id = $6 RETURNING *`,
      [title, body, audience, status, publishedAt, id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Announcement not found.' });

    return res.status(200).json({ success: true, announcement: result.rows[0] });
  } catch (err) {
    console.error('Admin updateAnnouncement error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM announcements WHERE id = $1 RETURNING id`, [req.params.id]
    );
    if (!result.rows[0])
      return res.status(404).json({ success: false, message: 'Announcement not found.' });

    return res.status(200).json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    console.error('Admin deleteAnnouncement error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Reports ──────────────────────────────────────────────────
const getAttendanceReport = async (req, res) => {
  try {
    const { class_id, date_from, date_to } = req.query;

    let sql = `
      SELECT
        u.first_name || ' ' || u.last_name AS learner_name,
        lp.student_number,
        c.name AS class_name,
        COUNT(*) FILTER (WHERE a.status = 'present') AS present,
        COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
        COUNT(*) FILTER (WHERE a.status = 'late')    AS late,
        COUNT(*) FILTER (WHERE a.status = 'excused') AS excused,
        COUNT(*) AS total
      FROM attendance a
      JOIN users u ON u.id = a.learner_id
      JOIN learner_profiles lp ON lp.user_id = u.id
      JOIN classes c ON c.id = lp.class_id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) { params.push(class_id); sql += ` AND lp.class_id = $${params.length}`; }
    if (date_from) { params.push(date_from); sql += ` AND a.date >= $${params.length}`; }
    if (date_to)   { params.push(date_to);   sql += ` AND a.date <= $${params.length}`; }

    sql += ` GROUP BY u.id, lp.student_number, c.name ORDER BY c.name, u.last_name`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, report: result.rows });
  } catch (err) {
    console.error('Admin getAttendanceReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getMarksReport = async (req, res) => {
  try {
    const { class_id, term } = req.query;

    let sql = `
      SELECT
        u.first_name || ' ' || u.last_name AS learner_name,
        lp.student_number,
        c.name  AS class_name,
        s.name  AS subject,
        a.term,
        a.title AS assessment,
        a.total_marks,
        m.marks_obtained,
        ROUND(m.marks_obtained / a.total_marks * 100, 2) AS percentage
      FROM marks m
      JOIN users u            ON u.id  = m.learner_id
      JOIN learner_profiles lp ON lp.user_id = u.id
      JOIN classes c          ON c.id  = lp.class_id
      JOIN assessments a      ON a.id  = m.assessment_id
      JOIN class_subjects cs  ON cs.id = a.class_subject_id
      JOIN subjects s         ON s.id  = cs.subject_id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) { params.push(class_id); sql += ` AND lp.class_id = $${params.length}`; }
    if (term)     { params.push(term);      sql += ` AND a.term = $${params.length}`; }

    sql += ` ORDER BY c.name, u.last_name, s.name`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, report: result.rows });
  } catch (err) {
    console.error('Admin getMarksReport error:', err.message);
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
         lp.student_number,
         c.name AS class_name
       FROM fee_accounts fa
       JOIN fee_structures fs  ON fs.id = fa.fee_structure_id
       JOIN users u            ON u.id  = fa.learner_id
       JOIN learner_profiles lp ON lp.user_id = fa.learner_id
       JOIN classes c          ON c.id  = lp.class_id
       ORDER BY fa.status, fa.due_date`
    );
    return res.status(200).json({ success: true, fees: result.rows });
  } catch (err) {
    console.error('Admin getFees error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createFeeStructure = async (req, res) => {
  try {
    const { name, grade_id, amount, year, term, description } = req.body;
    if (!name || !amount || !year)
      return res.status(400).json({ success: false, message: 'Name, amount and year are required.' });

    const result = await query(
      `INSERT INTO fee_structures (name, grade_id, amount, year, term, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, grade_id || null, amount, year, term || null, description || null]
    );
    return res.status(201).json({ success: true, fee_structure: result.rows[0] });
  } catch (err) {
    console.error('Admin createFeeStructure error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { id: feeAccountId } = req.params;
    const { amount, method, reference, notes } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });

    const feeAccount = await query(
      `SELECT * FROM fee_accounts WHERE id = $1`, [feeAccountId]
    );
    if (!feeAccount.rows[0])
      return res.status(404).json({ success: false, message: 'Fee account not found.' });

    const fee = feeAccount.rows[0];

    await query(
      `INSERT INTO payments (fee_account_id, amount, method, reference, recorded_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [feeAccountId, amount, method || null, reference || null, req.user.id, notes || null]
    );

    const newAmountPaid = parseFloat(fee.amount_paid) + parseFloat(amount);
    const newStatus = newAmountPaid >= parseFloat(fee.amount_due) ? 'paid' : 'pending';

    await query(
      `UPDATE fee_accounts SET amount_paid = $1, status = $2 WHERE id = $3`,
      [newAmountPaid, newStatus, feeAccountId]
    );

    return res.status(201).json({ success: true, message: 'Payment recorded.' });
  } catch (err) {
    console.error('Admin recordPayment error:', err.message);
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
    console.error('Admin getMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipient_id, subject, body } = req.body;

    if (!recipient_id || !body)
      return res.status(400).json({ success: false, message: 'Recipient and body are required.' });

    // Admin can only message teachers
    const recipient = await query(
      `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE`,
      [recipient_id]
    );

    if (!recipient.rows[0])
      return res.status(404).json({ success: false, message: 'Recipient not found.' });

    if (recipient.rows[0].role !== 'teacher')
      return res.status(403).json({ success: false, message: 'Admin can only message teachers.' });

    await query(
      `INSERT INTO messages (sender_id, recipient_id, subject, body)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, recipient_id, subject || null, body]
    );

    return res.status(201).json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error('Admin sendMessage error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── Audit Logs ───────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const { role, action, date_from, date_to } = req.query;

    let sql = `
      SELECT id, user_id, user_name, role, action, details,
             ip_address, status, created_at
      FROM audit_logs WHERE 1=1
    `;
    const params = [];

    if (role)      { params.push(role);      sql += ` AND role = $${params.length}`; }
    if (action)    { params.push(`%${action}%`); sql += ` AND action ILIKE $${params.length}`; }
    if (date_from) { params.push(date_from); sql += ` AND created_at >= $${params.length}`; }
    if (date_to)   { params.push(date_to);   sql += ` AND created_at <= $${params.length}`; }

    sql += ` ORDER BY created_at DESC LIMIT 500`;

    const result = await query(sql, params);
    return res.status(200).json({ success: true, logs: result.rows });
  } catch (err) {
    console.error('Admin getAuditLogs error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getMetrics = async (req, res) => {
  try {
    if (req.headers.accept?.includes('text/plain')) {
      const metricsText = await collectMetrics();
      return res.type('text/plain').send(metricsText);
    }
    const metricsJson = await collectMetricsJson();
    return res.status(200).json({ success: true, metrics: metricsJson });
  } catch (err) {
    console.error('Admin getMetrics error:', err.message);
    return res.status(500).json({ success: false, message: 'Unable to fetch metrics.' });
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
    console.error('Admin getNotifications error:', err.message);
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
    console.error('Admin markNotificationRead error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAttendanceReport,
  getMarksReport,
  getFees,
  createFeeStructure,
  recordPayment,
  getMessages,
  sendMessage,
  getAuditLogs,
  getMetrics,
  getNotifications,
  markNotificationRead
};