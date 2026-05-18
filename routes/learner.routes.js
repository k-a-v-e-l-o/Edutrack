const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const controller  = require('../controllers/learner.controller');

router.use(verifyToken, roleGuard('learner'));

router.get('/dashboard/stats',  controller.getDashboardStats);
router.get('/grades',           controller.getGrades);
router.get('/attendance',       controller.getAttendance);
router.get('/timetable',        controller.getTimetable);
router.get('/resources',        controller.getResources);
router.get('/announcements',    controller.getAnnouncements);
router.get('/messages',         controller.getMessages);
router.post('/messages',        controller.sendMessage);
router.get('/notifications',    controller.getNotifications);
router.patch('/notifications/:id/read', controller.markNotificationRead);

module.exports = router;