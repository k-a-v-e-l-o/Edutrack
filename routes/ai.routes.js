const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const controller  = require('../controllers/ai.controller');

router.use(verifyToken, roleGuard('learner'));

router.post('/chat',    controller.sendChatMessage);
router.get('/history',  controller.getChatHistory);

module.exports = router;