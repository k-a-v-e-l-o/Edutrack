const { body } = require('express-validator');
const router      = require('express').Router();
const verifyToken = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const validateRequest = require('../middleware/validateRequest');
const controller  = require('../controllers/ai.controller');

router.use(verifyToken, roleGuard('learner'));

const chatValidation = [
  body('message').trim().notEmpty().withMessage('Message is required.'),
  body('history').optional().isArray().withMessage('History must be an array.'),
];

router.post('/chat', chatValidation, validateRequest, controller.sendChatMessage);
router.get('/history',  controller.getChatHistory);

module.exports = router;