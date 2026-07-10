const { body } = require('express-validator');
const router     = require('express').Router();
const controller = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

const registerValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required.'),
  body('last_name').trim().notEmpty().withMessage('Last name is required.'),
  body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('role')
    .isIn(['admin', 'teacher', 'parent', 'learner'])
    .withMessage('Role must be one of admin, teacher, parent, learner.'),
  body('phone').optional().trim().isMobilePhone('any').withMessage('Valid phone number required.'),
];

router.post('/login', loginValidation, validateRequest, controller.login);
router.post('/register', registerValidation, validateRequest, controller.register);
router.post('/logout',   verifyToken, controller.logout);
router.get('/me',        verifyToken, controller.getMe);
router.post('/fcm-token', verifyToken, controller.saveFcmToken);

module.exports = router;