const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');
const {
    validate,
    banUserSchema,
    editUserSchema,
    resetPasswordSchema,
    forceEditOrderSchema,
    reassignOrderSchema,
    forceStatusSchema
} = require('../validations/admin.validation');

// All admin routes require Token Verification and Admin privileges
router.use(verifyToken);
router.use(isAdmin);

// Dashboard
router.get('/stats', adminController.getStats);

// Orders Management
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetail);
router.patch('/orders/:id/force-edit', validate(forceEditOrderSchema), adminController.forceEditOrder);
router.patch('/orders/:id/reassign', validate(reassignOrderSchema), adminController.reassignOrder);
router.patch('/orders/:id/force-status', validate(forceStatusSchema), adminController.forceStatus);

// User Management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserProfile);
router.patch('/users/:id/ban', validate(banUserSchema), adminController.banUser);
router.patch('/users/:id/edit', validate(editUserSchema), adminController.editUser);
router.post('/users/:id/reset-password', validate(resetPasswordSchema), adminController.resetPassword);

// Logistics
router.get('/couriers/available', adminController.getAvailableCouriers);

// System Audit
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
