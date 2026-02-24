const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const authController = require('../controllers/halan_auth.controller');
const { validate, halanLoginSchema, halanRegisterSchema } = require('../validations/halan_auth.validation');

// Login (Public)
const { authLimiter } = require('../middleware/security');

router.post('/login', authLimiter, validate(halanLoginSchema), authController.login);

// All other routes are protected
router.use(verifyToken);

// Current User (Protected)
router.get('/me', authController.getMe);

// Team Registration (Protected - Owner only handled in controller)
router.post('/register', validate(halanRegisterSchema), authController.registerMember);

module.exports = router;
