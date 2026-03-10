const express = require('express');
const router = express.Router();

const {
    registerSchema,
    loginSchema,
    providerRequestSchema,
    updateProfileSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    validate
} = require('../validations/auth.validation');
const { verifyToken, isAdmin } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');
const { authLimiter, globalLimiter } = require('../middleware/security');

// Public routes with stricter rate limiting and validation
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/guest-login', authLimiter, authController.guestLogin);
router.post('/provider-request', authLimiter, validate(providerRequestSchema), authController.submitProviderRequest);

// Password Recovery
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Google OAuth Sync — creates or fetches a user based on their Google account
// Rate-limited like login to prevent abuse
router.post('/google-sync', authLimiter, authController.googleSync);

// Refresh Token
router.post('/refresh', authLimiter, authController.refreshToken);


// Protected routes (require valid JWT token)
router.use(verifyToken);
router.get('/me', authController.getMe);
router.put('/profile', validate(updateProfileSchema), authController.updateProfile);

// Admin-only routes
router.use(isAdmin);
router.get('/requests', authController.getRequests);
router.post('/requests/:id/approve', authController.approveRequest);
router.post('/requests/:id/reject', authController.rejectRequest);

module.exports = router;
