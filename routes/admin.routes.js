const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const controller  = require('../controllers/admin.controller');

router.use(verifyToken, roleGuard('admin'));

// Dashboard
router.get('/dashboard/stats',       controller.getDashboardStats);

// Users
router.get('/users',                 controller.getUsers);
router.get('/users/:id',             controller.getUserById);
router.post('/users',                controller.createUser);
router.put('/users/:id',             controller.updateUser);
router.delete('/users/:id',          controller.deleteUser);

// Classes
router.get('/classes',               controller.getClasses);
router.post('/classes',              controller.createClass);
router.put('/classes/:id',           controller.updateClass);
router.delete('/classes/:id',        controller.deleteClass);

// Subjects
router.get('/subjects',              controller.getSubjects);
router.post('/subjects',             controller.createSubject);
router.put('/subjects/:id',          controller.updateSubject);
router.delete('/subjects/:id',       controller.deleteSubject);

// Announcements
router.get('/announcements',         controller.getAnnouncements);
router.post('/announcements',        controller.createAnnouncement);
router.put('/announcements/:id',     controller.updateAnnouncement);
router.delete('/announcements/:id',  controller.deleteAnnouncement);

// Reports
router.get('/reports/attendance',    controller.getAttendanceReport);
router.get('/reports/marks',         controller.getMarksReport);

// Fees
router.get('/fees',                  controller.getFees);
router.post('/fees/structure',       controller.createFeeStructure);
router.post('/fees/:id/record',      controller.recordPayment);

// Messages
router.get('/messages',              controller.getMessages);
router.post('/messages',             controller.sendMessage);

// Audit logs
router.get('/audit-logs',            controller.getAuditLogs);

// Notifications
router.get('/notifications',         controller.getNotifications);
router.patch('/notifications/:id/read', controller.markNotificationRead);

module.exports = router;