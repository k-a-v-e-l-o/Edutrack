const { query } = require('../db');

const findByEmail = (email) =>
  query(`SELECT * FROM users WHERE email = $1`, [email]);

const findById = (id) =>
  query(
    `SELECT id, email, role, first_name, last_name, phone, gender,
            date_of_birth, profile_photo, is_active, last_login, created_at
     FROM users WHERE id = $1`,
    [id]
  );

const updateLastLogin = (id) =>
  query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [id]);

const updateProfile = (id, fields) => {
  const { first_name, last_name, phone, gender, date_of_birth, profile_photo } = fields;
  return query(
    `UPDATE users
     SET first_name    = COALESCE($1, first_name),
         last_name     = COALESCE($2, last_name),
         phone         = COALESCE($3, phone),
         gender        = COALESCE($4, gender),
         date_of_birth = COALESCE($5, date_of_birth),
         profile_photo = COALESCE($6, profile_photo)
     WHERE id = $7 RETURNING id, email, role, first_name, last_name, phone, gender, date_of_birth, profile_photo`,
    [first_name, last_name, phone, gender, date_of_birth, profile_photo, id]
  );
};

const updatePassword = (id, password_hash) =>
  query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [password_hash, id]);

const deactivate = (id) =>
  query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [id]);

module.exports = {
  findByEmail,
  findById,
  updateLastLogin,
  updateProfile,
  updatePassword,
  deactivate
};