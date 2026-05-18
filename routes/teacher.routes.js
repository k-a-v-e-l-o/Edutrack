const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const controller  = require('../controllers/teacher.controller');

router.use(verifyToken, roleGuard('teacher'));

router.get('/dashboard/stats',            controller.getDashboardStats);
router.get('/classes',                    controller.getClasses);
router.get('/classes/:id/learners',       controller.getClassLearners);
router.post('/attendance',                controller.markAttendance);
router.get('/attendance/:classSubjectId', controller.getAttendance);
router.get('/assessments',                controller.getAssessments);
router.post('/assessments',               controller.createAssessment);
router.put('/assessments/:id',            controller.updateAssessment);
router.get('/assessments/:id/marks',      controller.getMarks);
router.post('/assessments/:id/marks',     controller.submitMarks);
router.get('/resources',                  controller.getResources);
router.post('/resources',                 controller.uploadResource);
router.delete('/resources/:id',           controller.deleteResource);
router.get('/messages',                   controller.getMessages);
router.post('/messages',                  controller.sendMessage);
router.get('/notifications',              controller.getNotifications);
router.patch('/notifications/:id/read',   controller.markNotificationRead);

module.exports = router;