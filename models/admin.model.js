const { query } = require('../db');

const getAllUsers = (filters = {}) => {
  const { role, search } = filters;
  let sql = `
    SELECT id, email, role, first_name, last_name, phone,
           gender, is_active, last_login, created_at
    FROM users WHERE 1=1
  `;
  const params = [];

  if (role)   { params.push(role);          sql += ` AND role = $${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`; }

  sql += ` ORDER BY created_at DESC`;
  return query(sql, params);
};

const getAllClasses = () =>
  query(
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

const getAllGrades = () =>
  query(`SELECT * FROM grades ORDER BY level`);

const getAllSubjects = () =>
  query(`SELECT * FROM subjects ORDER BY name`);

const getAllFees = () =>
  query(
    `SELECT
       fa.id, fa.amount_due, fa.amount_paid, fa.status, fa.due_date,
       fa.amount_due - fa.amount_paid AS balance,
       fs.name AS fee_name, fs.year, fs.term,
       u.first_name || ' ' || u.last_name AS learner_name,
       lp.student_number, c.name AS class_name
     FROM fee_accounts fa
     JOIN fee_structures fs   ON fs.id = fa.fee_structure_id
     JOIN users u             ON u.id  = fa.learner_id
     JOIN learner_profiles lp ON lp.user_id = fa.learner_id
     JOIN classes c           ON c.id  = lp.class_id
     ORDER BY fa.status, fa.due_date`
  );

const getAuditLogs = (filters = {}) => {
  const { role, action, date_from, date_to } = filters;
  let sql = `
    SELECT id, user_id, user_name, role, action, details,
           ip_address, status, created_at
    FROM audit_logs WHERE 1=1
  `;
  const params = [];

  if (role)      { params.push(role);            sql += ` AND role = $${params.length}`; }
  if (action)    { params.push(`%${action}%`);   sql += ` AND action ILIKE $${params.length}`; }
  if (date_from) { params.push(date_from);       sql += ` AND created_at >= $${params.length}`; }
  if (date_to)   { params.push(date_to);         sql += ` AND created_at <= $${params.length}`; }

  sql += ` ORDER BY created_at DESC LIMIT 500`;
  return query(sql, params);
};

module.exports = {
  getAllUsers,
  getAllClasses,
  getAllGrades,
  getAllSubjects,
  getAllFees,
  getAuditLogs
};