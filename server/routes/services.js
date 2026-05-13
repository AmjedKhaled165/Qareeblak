const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service_item.controller');
const { verifyToken, isProviderOrAdmin } = require('../middleware/auth');
const { validate, createServiceSchema, updateServiceSchema } = require('../validations/service_item.validation');

// Public Routes
const { cacheMiddleware } = require('../utils/redis-cache');

router.get('/provider/:providerId', cacheMiddleware(180), serviceController.getByProvider);

// Protected Provider/Admin Routes
router.use(verifyToken);
router.use(isProviderOrAdmin);

router.post('/', validate(createServiceSchema), serviceController.create);
router.put('/:id', validate(updateServiceSchema), serviceController.update);
router.delete('/:id', serviceController.delete);

module.exports = router;
