const express = require('express');
const router = express.Router();
const providerController = require('../controllers/provider.controller');
const { validate, addReviewSchema } = require('../validations/provider.validation');
const { verifyToken, isProviderOrAdmin, isAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// Public Routes
const { cacheMiddleware } = require('../utils/redis-cache');

router.get('/', cacheMiddleware(300), providerController.getAll);
router.get('/search', cacheMiddleware(300), providerController.search);
router.get('/:id', cacheMiddleware(180), providerController.getById);
router.get('/by-email/:email', cacheMiddleware(180), providerController.getByEmail);
router.post('/:id/reviews', authLimiter, validate(addReviewSchema), providerController.addReview);

// Provider/Admin Protected Routes
router.use(verifyToken);
router.put('/profile', isProviderOrAdmin, providerController.updateProfile);

// Admin-only Routes
router.delete('/:id', isAdmin, providerController.deleteProvider);

module.exports = router;
