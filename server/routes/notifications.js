const express = require('express');
const router = express.Router();
const db = require('../db');

const { verifyToken } = require('../middleware/auth');
const AppError = require('../utils/appError');

// All notification routes require authentication
router.use(verifyToken);

// ==========================================
// GET /api/notifications
// Fetch notifications for the logged-in user
// ==========================================
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;
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
        next(error);
    }
});

// ==========================================
// GET /api/notifications/unread-count
// Get unread notification count for the logged-in user
// ==========================================
router.get('/unread-count', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// PATCH /api/notifications/:id/read
// Mark a single notification as read (Verify ownership)
// ==========================================
router.patch('/:id/read', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return next(new AppError('التنبيه غير موجود أو غير تابع لك', 404));
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// PATCH /api/notifications/read-all
// Mark all notifications as read for the logged-in user
// ==========================================
router.patch('/read-all', async (req, res, next) => {
    try {
        const userId = req.user.id;
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
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
