const { query } = require('../db');

const getProfile = (userId) =>
  query(
    `SELECT
       u.id, u.first_name, u.last_name, u.email, u.phone, u.gender,
       u.profile_photo, pp.occupation
     FROM users u
     JOIN parent_profiles pp ON pp.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

const getChildren = (parentId) =>
  query(
    `SELECT
       u.id, u.first_name, u.last_name, u.email, u.profile_photo,
       pl.relationship, pl.is_primary,
       lp.student_number, lp.enrollment_date,
       c.name AS class_name,
       g.name AS grade_name
     FROM parent_learners pl
     JOIN users u             ON u.id  = pl.learner_id
     JOIN learner_profiles lp ON lp.user_id = pl.learner_id
     JOIN classes c           ON c.id  = lp.class_id
     JOIN grades g            ON g.id  = c.grade_id
     WHERE pl.parent_id = $1`,
    [parentId]
  );

const isMyChild = (parentId, learnerId) =>
  query(
    `SELECT 1 FROM parent_learners
     WHERE parent_id = $1 AND learner_id = $2`,
    [parentId, learnerId]
  );

const getFees = (parentId) =>
  query(
    `SELECT
       fa.id, fa.amount_due, fa.amount_paid, fa.status, fa.due_date,
       fa.amount_due - fa.amount_paid AS balance,
       fs.name AS fee_name, fs.year, fs.term,
       u.first_name || ' ' || u.last_name AS learner_name,
       lp.student_number
     FROM fee_accounts fa
     JOIN fee_structures fs   ON fs.id = fa.fee_structure_id
     JOIN parent_learners pl  ON pl.learner_id = fa.learner_id
     JOIN users u             ON u.id  = fa.learner_id
     JOIN learner_profiles lp ON lp.user_id = fa.learner_id
     WHERE pl.parent_id = $1
     ORDER BY fa.due_date DESC`,
    [parentId]
  );

module.exports = {
  getProfile,
  getChildren,
  isMyChild,
  getFees
};