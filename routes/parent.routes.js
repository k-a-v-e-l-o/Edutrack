const { body, param } = require('express-validator');
const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const validateRequest = require('../middleware/validateRequest');
const controller  = require('../controllers/parent.controller');

router.use(verifyToken, roleGuard('parent'));

const childIdValidation = [
  param('id').isInt().withMessage('Child ID must be a valid integer.'),
];

const paymentValidation = [
  param('id').isInt().withMessage('Fee ID must be a valid integer.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Payment amount must be greater than 0.'),
  body('method').trim().notEmpty().withMessage('Payment method is required.'),
];

const messageValidation = [
  body('recipient_id').isInt().withMessage('Recipient ID is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('body').trim().notEmpty().withMessage('Message body is required.'),
];

const notificationReadValidation = [
  param('id').isInt().withMessage('Notification ID must be a valid integer.'),
];

router.get('/dashboard/stats',          controller.getDashboardStats);
router.get('/children',                 controller.getChildren);
router.get('/children/:id/grades',      childIdValidation, validateRequest, controller.getChildGrades);
router.get('/children/:id/attendance',  childIdValidation, validateRequest, controller.getChildAttendance);
router.get('/children/:id/timetable',   childIdValidation, validateRequest, controller.getChildTimetable);
router.get('/fees',                     controller.getFees);
router.post('/fees/:id/pay', paymentValidation, validateRequest, controller.makePayment);
router.get('/announcements',            controller.getAnnouncements);
router.get('/messages',                 controller.getMessages);
router.post('/messages', messageValidation, validateRequest, controller.sendMessage);
router.get('/notifications',            controller.getNotifications);
router.patch('/notifications/:id/read', notificationReadValidation, validateRequest, controller.markNotificationRead);

module.exports = router;