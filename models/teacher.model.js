const { query } = require('../db');

const getProfile = (userId) =>
  query(
    `SELECT
       u.id, u.first_name, u.last_name, u.email, u.phone, u.gender,
       u.profile_photo,
       tp.employee_number, tp.qualification, tp.specialization, tp.join_date
     FROM users u
     JOIN teacher_profiles tp ON tp.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

const getClasses = (teacherId) =>
  query(
    `SELECT
       cs.id AS class_subject_id,
       c.id AS class_id, c.name AS class_name, c.room,
       s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
       g.name AS grade_name,
       COUNT(lp.user_id) AS learner_count
     FROM class_subjects cs
     JOIN classes c           ON c.id = cs.class_id
     JOIN subjects s          ON s.id = cs.subject_id
     JOIN grades g            ON g.id = c.grade_id
     LEFT JOIN learner_profiles lp ON lp.class_id = c.id
     WHERE cs.teacher_id = $1
     GROUP BY cs.id, c.id, s.id, g.name
     ORDER BY c.name, s.name`,
    [teacherId]
  );

const ownsClassSubject = (classSubjectId, teacherId) =>
  query(
    `SELECT 1 FROM class_subjects WHERE id = $1 AND teacher_id = $2`,
    [classSubjectId, teacherId]
  );

const ownsAssessment = (assessmentId, teacherId) =>
  query(
    `SELECT 1 FROM assessments a
     JOIN class_subjects cs ON cs.id = a.class_subject_id
     WHERE a.id = $1 AND cs.teacher_id = $2`,
    [assessmentId, teacherId]
  );

const getAssessmentTypes = () =>
  query(`SELECT * FROM assessment_types ORDER BY name`);

module.exports = {
  getProfile,
  getClasses,
  ownsClassSubject,
  ownsAssessment,
  getAssessmentTypes
};