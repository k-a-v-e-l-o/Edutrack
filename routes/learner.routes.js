const { body, param } = require('express-validator');
const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const validateRequest = require('../middleware/validateRequest');
const controller  = require('../controllers/learner.controller');

router.use(verifyToken, roleGuard('learner'));

const messageValidation = [
  body('recipient_id').isInt().withMessage('Recipient ID is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('body').trim().notEmpty().withMessage('Message body is required.'),
];

const notificationReadValidation = [
  param('id').isInt().withMessage('Notification ID must be a valid integer.'),
];

router.get('/dashboard/stats',  controller.getDashboardStats);
router.get('/grades',           controller.getGrades);
router.get('/attendance',       controller.getAttendance);
router.get('/timetable',        controller.getTimetable);
router.get('/resources',        controller.getResources);
router.get('/announcements',    controller.getAnnouncements);
router.get('/messages',         controller.getMessages);
router.post('/messages', messageValidation, validateRequest, controller.sendMessage);
router.get('/notifications',    controller.getNotifications);
router.patch('/notifications/:id/read', notificationReadValidation, validateRequest, controller.markNotificationRead);

module.exports = router;