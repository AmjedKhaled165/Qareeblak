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

// Dashboard & BI
router.get('/stats', adminController.getStats);
router.get('/providers-performance', adminController.getProvidersPerformance);
router.get('/providers-performance/:id/orders', adminController.getProviderDetailedReport);

// Finance & Payouts (No Mercy)
router.get('/finance/summary', adminController.getFinanceSummary);
router.get('/finance/provider/:id', adminController.getProviderFinanceReport);
router.post('/finance/payouts', adminController.createPayout);
router.get('/finance/payouts', adminController.getPayouts);

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

// System Audit & Chaos (Elite SRE)
router.get('/audit-logs', adminController.getAuditLogs);

// 🛠️ [Chaos Engineering] Fault Injection — DEV/STAGING ONLY
// These endpoints are DISABLED in production to prevent accidental or malicious disruption
if (process.env.NODE_ENV !== 'production') {
    const chaos = require('../utils/resilience');
    router.post('/chaos/db-failure', (req, res) => {
        const { status } = req.body;
        chaos.setDBFailure(status);
        res.json({ success: true, db_failure: status });
    });

    router.post('/chaos/latency', (req, res) => {
        const { ms } = req.body;
        chaos.setLatency(ms);
        res.json({ success: true, latency_injection: ms });
    });
}

module.exports = router;
