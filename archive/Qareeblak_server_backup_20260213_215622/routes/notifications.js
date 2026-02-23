const express = require('express');
const router = express.Router();
const db = require('../db');

// ==========================================
// GET /api/notifications/user/:userId
// Fetch notifications for a user
// ==========================================
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { unread } = req.query;

        let query = 'SELECT * FROM notifications WHERE user_id = $1';
        const params = [userId];

        if (unread === 'true') {
            query += ' AND is_read = FALSE';
        }

        query += ' ORDER BY created_at DESC LIMIT 50';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// ==========================================
// GET /api/notifications/user/:userId/unread-count
// Get unread notification count for badge
// ==========================================
router.get('/user/:userId/unread-count', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// ==========================================
// PATCH /api/notifications/:id/read
// Mark a single notification as read
// ==========================================
router.patch('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1',
            [id]
        );
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// ==========================================
// PATCH /api/notifications/user/:userId/read-all
// Mark all notifications as read for a user
// ==========================================
router.patch('/user/:userId/read-all', async (req, res) => {
    try {
        const { userId } = req.params;
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// ==========================================
// Helper: Create a notification (used internally by other routes)
// ==========================================
async function createNotification(userId, message, type, referenceId = null, io = null) {
    try {
        const result = await db.query(
            `INSERT INTO notifications (user_id, message, type, reference_id)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, message, type, referenceId]
        );
        const notification = result.rows[0];

        // Emit real-time notification via Socket.io
        if (io) {
            io.emit('new-notification', {
                userId: String(userId),
                notification
            });
        }

        return notification;
    } catch (error) {
        console.error('Create notification error:', error);
        return null;
    }
}

module.exports = router;
module.exports.createNotification = createNotification;
