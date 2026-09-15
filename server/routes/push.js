const express = require('express');
const router = express.Router();
const webPushService = require('../services/web-push.service');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// ==========================================
// GET /api/push/vapid-key
// Get the VAPID public key for the frontend to subscribe
// ==========================================
router.get('/vapid-key', (req, res) => {
    if (!webPushService.isConfigured()) {
        return res.status(503).json({ error: 'Web Push is not configured on the server' });
    }
    res.json({ publicKey: webPushService.getVapidPublicKey() });
});

// ==========================================
// POST /api/push/subscribe
// Save a push subscription for the logged-in user
// ==========================================
router.post('/subscribe', verifyToken, async (req, res) => {
    try {
        const { subscription, userAgent } = req.body;
        const userId = req.user.id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        const success = await webPushService.saveSubscription(userId, subscription, userAgent);
        if (success) {
            res.status(201).json({ success: true, message: 'Subscription saved' });
        } else {
            res.status(500).json({ error: 'Failed to save subscription' });
        }
    } catch (error) {
        logger.error(`[PushAPI] Subscribe error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==========================================
// DELETE /api/push/unsubscribe
// Remove a push subscription
// ==========================================
router.delete('/unsubscribe', verifyToken, async (req, res) => {
    try {
        const { endpoint } = req.body;
        
        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint is required' });
        }

        const success = await webPushService.removeSubscription(endpoint);
        if (success) {
            res.json({ success: true, message: 'Subscription removed' });
        } else {
            res.status(500).json({ error: 'Failed to remove subscription' });
        }
    } catch (error) {
        logger.error(`[PushAPI] Unsubscribe error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==========================================
// POST /api/push/test
// Test push notification (Development only)
// ==========================================
router.post('/test', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, body } = req.body;
        
        const result = await webPushService.sendNotification(userId, title || 'Test Push', body || 'This is a test notification from Qareeblak.');
        
        if (result.success) {
            res.json({ success: true, message: `Sent ${result.sent} notifications` });
        } else {
            res.status(500).json({ error: result.error || result.reason });
        }
    } catch (error) {
        logger.error(`[PushAPI] Test push error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
