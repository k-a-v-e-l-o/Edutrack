const { body, param, query } = require('express-validator');
const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const validateRequest = require('../middleware/validateRequest');
const controller  = require('../controllers/teacher.controller');

router.use(verifyToken, roleGuard('teacher'));

const classIdValidation = [
  param('id').isInt().withMessage('Class ID must be a valid integer.'),
];

const classSubjectIdValidation = [
  param('classSubjectId').isInt().withMessage('Class subject ID must be a valid integer.'),
];

const attendanceValidation = [
  body('class_subject_id').isInt().withMessage('Class subject ID is required.'),
  body('date').isISO8601().withMessage('Valid date is required.'),
  body('records').isArray({ min: 1 }).withMessage('Attendance records are required.'),
];

const attendanceQueryValidation = [
  param('classSubjectId').isInt().withMessage('Class subject ID must be a valid integer.'),
  query('date').optional().isISO8601().withMessage('Date must be valid.'),
];

const assessmentCreateValidation = [
  body('class_subject_id').isInt().withMessage('Class subject ID is required.'),
  body('assessment_type_id').isInt().withMessage('Assessment type ID is required.'),
  body('term').trim().notEmpty().withMessage('Term is required.'),
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('total_marks').isInt({ gt: 0 }).withMessage('Total marks must be greater than 0.'),
  body('date').isISO8601().withMessage('Valid date is required.'),
];

const assessmentUpdateValidation = [
  param('id').isInt().withMessage('Assessment ID must be a valid integer.'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty.'),
  body('total_marks').optional().isInt({ gt: 0 }).withMessage('Total marks must be greater than 0.'),
  body('date').optional().isISO8601().withMessage('Valid date is required.'),
  body('term').optional().trim().notEmpty().withMessage('Term cannot be empty.'),
];

const marksSubmitValidation = [
  param('id').isInt().withMessage('Assessment ID must be a valid integer.'),
  body('marks').isArray({ min: 1 }).withMessage('Marks array is required.'),
];

const resourceValidation = [
  body('class_subject_id').isInt().withMessage('Class subject ID is required.'),
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('description').trim().notEmpty().withMessage('Description is required.'),
  body('type').trim().notEmpty().withMessage('Resource type is required.'),
  body('url').isURL().withMessage('Valid URL is required.'),
];

const messageValidation = [
  body('recipient_id').isInt().withMessage('Recipient ID is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('body').trim().notEmpty().withMessage('Message body is required.'),
];

const notificationReadValidation = [
  param('id').isInt().withMessage('Notification ID must be a valid integer.'),
];

router.get('/dashboard/stats',            controller.getDashboardStats);
router.get('/classes',                    controller.getClasses);
router.get('/classes/:id/learners',       classIdValidation, validateRequest, controller.getClassLearners);
router.post('/attendance',                attendanceValidation, validateRequest, controller.markAttendance);
router.get('/attendance/:classSubjectId', attendanceQueryValidation, validateRequest, controller.getAttendance);
router.get('/assessments',                controller.getAssessments);
router.post('/assessments',               assessmentCreateValidation, validateRequest, controller.createAssessment);
router.put('/assessments/:id',            assessmentUpdateValidation, validateRequest, controller.updateAssessment);
router.get('/assessments/:id/marks',      param('id').isInt().withMessage('Assessment ID must be a valid integer.'), validateRequest, controller.getMarks);
router.post('/assessments/:id/marks',     marksSubmitValidation, validateRequest, controller.submitMarks);
router.get('/resources',                  controller.getResources);
router.post('/resources',                 resourceValidation, validateRequest, controller.uploadResource);
router.delete('/resources/:id',           param('id').isInt().withMessage('Resource ID must be a valid integer.'), validateRequest, controller.deleteResource);
router.get('/messages',                   controller.getMessages);
router.post('/messages',                  messageValidation, validateRequest, controller.sendMessage);
router.get('/notifications',              controller.getNotifications);
router.patch('/notifications/:id/read',   notificationReadValidation, validateRequest, controller.markNotificationRead);

module.exports = router;