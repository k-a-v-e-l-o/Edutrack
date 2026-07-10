const { body, param, query } = require('express-validator');
const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const validateRequest = require('../middleware/validateRequest');
const controller  = require('../controllers/admin.controller');

router.use(verifyToken, roleGuard('admin'));

const idParamValidation = [
  param('id').isInt().withMessage('ID must be a valid integer.'),
];

const userCreateValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required.'),
  body('last_name').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('role').isIn(['admin', 'teacher', 'parent', 'learner']).withMessage('Role must be valid.'),
];

const userUpdateValidation = [
  idParamValidation[0],
  body('first_name').optional().trim().notEmpty().withMessage('First name cannot be empty.'),
  body('last_name').optional().trim().notEmpty().withMessage('Last name cannot be empty.'),
  body('phone').optional().trim().isMobilePhone('any').withMessage('Valid phone number required.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
];

const classValidation = [
  body('name').trim().notEmpty().withMessage('Class name is required.'),
  body('grade_id').isInt().withMessage('Grade ID is required.'),
  body('room').trim().notEmpty().withMessage('Room is required.'),
  body('capacity').optional().isInt({ gt: 0 }).withMessage('Capacity must be greater than 0.'),
];

const subjectValidation = [
  body('name').trim().notEmpty().withMessage('Subject name is required.'),
  body('code').trim().notEmpty().withMessage('Subject code is required.'),
  body('description').trim().optional(),
];

const announcementValidation = [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('body').trim().notEmpty().withMessage('Body is required.'),
  body('audience').trim().notEmpty().withMessage('Audience is required.'),
  body('status').trim().notEmpty().withMessage('Status is required.'),
];

const feeStructureValidation = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('grade_id').isInt().withMessage('Grade ID is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0.'),
  body('year').isInt().withMessage('Valid year is required.'),
  body('term').trim().notEmpty().withMessage('Term is required.'),
];

const recordPaymentValidation = [
  idParamValidation[0],
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0.'),
  body('method').trim().notEmpty().withMessage('Payment method is required.'),
  body('reference').trim().optional(),
];

const messageValidation = [
  body('recipient_id').isInt().withMessage('Recipient ID is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('body').trim().notEmpty().withMessage('Message body is required.'),
];

const auditQueryValidation = [
  query('role').optional().trim(),
  query('action').optional().trim(),
  query('date_from').optional().isISO8601().withMessage('date_from must be valid.'),
  query('date_to').optional().isISO8601().withMessage('date_to must be valid.'),
];

const notificationReadValidation = [
  param('id').isInt().withMessage('Notification ID must be a valid integer.'),
];

// Dashboard
router.get('/dashboard/stats',       controller.getDashboardStats);

// Users
router.get('/users',                 controller.getUsers);
router.get('/users/:id',             idParamValidation, validateRequest, controller.getUserById);
router.post('/users',                userCreateValidation, validateRequest, controller.createUser);
router.put('/users/:id',             userUpdateValidation, validateRequest, controller.updateUser);
router.delete('/users/:id',          idParamValidation, validateRequest, controller.deleteUser);

// Classes
router.get('/classes',               controller.getClasses);
router.post('/classes',              classValidation, validateRequest, controller.createClass);
router.put('/classes/:id',           [...idParamValidation, ...classValidation], validateRequest, controller.updateClass);
router.delete('/classes/:id',        idParamValidation, validateRequest, controller.deleteClass);

// Subjects
router.get('/subjects',              controller.getSubjects);
router.post('/subjects',             subjectValidation, validateRequest, controller.createSubject);
router.put('/subjects/:id',          [...idParamValidation, ...subjectValidation], validateRequest, controller.updateSubject);
router.delete('/subjects/:id',       idParamValidation, validateRequest, controller.deleteSubject);

// Announcements
router.get('/announcements',         controller.getAnnouncements);
router.post('/announcements',        announcementValidation, validateRequest, controller.createAnnouncement);
router.put('/announcements/:id',     [...idParamValidation, ...announcementValidation], validateRequest, controller.updateAnnouncement);
router.delete('/announcements/:id',  idParamValidation, validateRequest, controller.deleteAnnouncement);

// Reports
router.get('/reports/attendance',    controller.getAttendanceReport);
router.get('/reports/marks',         controller.getMarksReport);

// Fees
router.get('/fees',                  controller.getFees);
router.post('/fees/structure',       feeStructureValidation, validateRequest, controller.createFeeStructure);
router.post('/fees/:id/record',      recordPaymentValidation, validateRequest, controller.recordPayment);

// Messages
router.get('/messages',              controller.getMessages);
router.post('/messages',             messageValidation, validateRequest, controller.sendMessage);

// Audit logs
router.get('/audit-logs',            auditQueryValidation, validateRequest, controller.getAuditLogs);
router.get('/metrics',               controller.getMetrics);

// Notifications
router.get('/notifications',         controller.getNotifications);
router.patch('/notifications/:id/read', notificationReadValidation, validateRequest, controller.markNotificationRead);

module.exports = router;