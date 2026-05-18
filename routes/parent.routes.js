const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const controller  = require('../controllers/parent.controller');

router.use(verifyToken, roleGuard('parent'));

router.get('/dashboard/stats',          controller.getDashboardStats);
router.get('/children',                 controller.getChildren);
router.get('/children/:id/grades',      controller.getChildGrades);
router.get('/children/:id/attendance',  controller.getChildAttendance);
router.get('/children/:id/timetable',   controller.getChildTimetable);
router.get('/fees',                     controller.getFees);
router.post('/fees/:id/pay',            controller.makePayment);
router.get('/announcements',            controller.getAnnouncements);
router.get('/messages',                 controller.getMessages);
router.post('/messages',                controller.sendMessage);
router.get('/notifications',            controller.getNotifications);
router.patch('/notifications/:id/read', controller.markNotificationRead);

module.exports = router;