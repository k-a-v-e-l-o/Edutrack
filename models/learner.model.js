const { query } = require('../db');

const getProfile = (userId) =>
  query(
    `SELECT
       u.id, u.first_name, u.last_name, u.email, u.phone, u.gender,
       u.date_of_birth, u.profile_photo,
       lp.student_number, lp.enrollment_date,
       c.name  AS class_name,
       c.room  AS class_room,
       g.name  AS grade_name,
       g.level AS grade_level
     FROM users u
     JOIN learner_profiles lp ON lp.user_id = u.id
     JOIN classes c           ON c.id = lp.class_id
     JOIN grades g            ON g.id = c.grade_id
     WHERE u.id = $1`,
    [userId]
  );

const getGrades = (userId) =>
  query(
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
    [userId]
  );

const getAttendance = (userId) =>
  query(
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
    [userId]
  );

const getTimetable = (userId) =>
  query(
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
    [userId]
  );

const getResources = (userId) =>
  query(
    `SELECT
       r.id, r.title, r.description, r.type, r.url, r.created_at,
       s.name AS subject,
       u.first_name || ' ' || u.last_name AS uploaded_by
     FROM resources r
     JOIN class_subjects cs   ON cs.id = r.class_subject_id
     JOIN subjects s          ON s.id  = cs.subject_id
     JOIN users u             ON u.id  = r.uploaded_by
     JOIN learner_profiles lp ON lp.class_id = cs.class_id
     WHERE lp.user_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );

module.exports = {
  getProfile,
  getGrades,
  getAttendance,
  getTimetable,
  getResources
};