const router     = require('express').Router();
const controller = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');

router.post('/login',    controller.login);
router.post('/logout',   verifyToken, controller.logout);
router.get('/me',        verifyToken, controller.getMe);

module.exports = router;