const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middleware
const { globalLimiter } = require('../middleware/security');
const deliveryController = require('../controllers/delivery.controller');
const {
    validate,
    createDeliveryOrderSchema,
    statusUpdateSchema
} = require('../validations/delivery.validation');

const { verifyToken, isPartnerOrAdmin } = require('../middleware/auth');

// Public customer tracking endpoints (phone/user based)
router.post('/customer-orders', globalLimiter, deliveryController.getCustomerOrdersPublic);
router.get('/track/:id', globalLimiter, deliveryController.trackOrderPublic);

router.use(verifyToken);
router.use(isPartnerOrAdmin);
router.use(globalLimiter);

// Get All Orders (Filtered by Role inside Controller/Service)
router.get('/', deliveryController.getOrders);

// Track/Get Single Order
router.get('/:id', deliveryController.getOrder);

// Create New Order (Supports Normal & Split Mode)
router.post('/', validate(createDeliveryOrderSchema), deliveryController.createOrder);

// Auto-Assign Courier
router.post('/:id/auto-assign', deliveryController.autoAssign);

// Update Status (Generic)
router.patch('/:id/status', validate(statusUpdateSchema), deliveryController.updateStatus);

// Soft Delete
router.delete('/:id', deliveryController.softDelete);

module.exports = router;
