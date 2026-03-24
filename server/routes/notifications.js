const express = require('express');
const router = express.Router();
const db = require('../db');

const { verifyToken } = require('../middleware/auth');
const AppError = require('../utils/appError');

let notificationsColumnsCache = null;

async function getNotificationsColumns() {
    if (notificationsColumnsCache) return notificationsColumnsCache;

    const result = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'notifications'`
    );

    notificationsColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return notificationsColumnsCache;
}

function pickFirstExisting(columns, candidates) {
    for (const c of candidates) {
        if (columns.has(c)) return c;
    }
    return null;
}

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
        const cols = await getNotificationsColumns();
        const messageCol = pickFirstExisting(cols, ['message', 'body', 'content', 'title']);
        const typeCol = pickFirstExisting(cols, ['type', 'notification_type']);
        const refCol = pickFirstExisting(cols, ['reference_id', 'reference', 'related_id']);
        const readCol = pickFirstExisting(cols, ['is_read', 'read']);

        let query = `
            SELECT
                id,
                user_id,
                ${messageCol ? `${messageCol}::text` : `'إشعار جديد'`} AS message,
                ${typeCol ? `${typeCol}::text` : `'info'`} AS type,
                ${refCol ? `${refCol}::text` : 'NULL'} AS reference_id,
                ${readCol ? `${readCol}` : 'FALSE'} AS is_read,
                created_at
            FROM notifications
            WHERE user_id = $1
        `;
        const params = [userId];

        if (unread === 'true' && readCol) {
            query += ` AND ${readCol} = FALSE`;
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
        const cols = await getNotificationsColumns();
        const readCol = pickFirstExisting(cols, ['is_read', 'read']);
        if (!readCol) {
            return res.json({ count: 0 });
        }
        const result = await db.query(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND ${readCol} = FALSE`,
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
        const cols = await getNotificationsColumns();
        const readCol = pickFirstExisting(cols, ['is_read', 'read']);
        if (!readCol) {
            return res.json({ success: true, message: 'No read-state column available' });
        }

        const result = await db.query(
            `UPDATE notifications SET ${readCol} = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`,
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
        const cols = await getNotificationsColumns();
        const readCol = pickFirstExisting(cols, ['is_read', 'read']);
        if (!readCol) {
            return res.json({ success: true, message: 'No read-state column available' });
        }
        await db.query(
            `UPDATE notifications SET ${readCol} = TRUE WHERE user_id = $1 AND ${readCol} = FALSE`,
            [userId]
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /api/notifications
// Create a notification for a specific user (internal app usage)
// ==========================================
router.post('/', async (req, res, next) => {
    try {
        const { userId, message, type, relatedId } = req.body || {};

        if (!userId || !message || !type) {
            return next(new AppError('بيانات الإشعار غير مكتملة', 400));
        }

        const io = req.app.get('io');
        const notification = await createNotification(userId, message, type, relatedId || null, io);

        if (!notification) {
            return next(new AppError('تعذر إنشاء الإشعار', 500));
        }

        res.status(201).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// Helper: Create a notification (used internally by other routes)
// ==========================================
async function createNotification(userId, message, type, referenceId = null, io = null) {
    try {
        const cols = await getNotificationsColumns();
        const messageCol = pickFirstExisting(cols, ['message', 'body', 'content', 'title']);
        const typeCol = pickFirstExisting(cols, ['type', 'notification_type']);
        const refCol = pickFirstExisting(cols, ['reference_id', 'reference', 'related_id']);
        const readCol = pickFirstExisting(cols, ['is_read', 'read']);

        const insertCols = ['user_id'];
        const values = ['$1'];
        const params = [userId];

        const push = (col, value) => {
            params.push(value);
            insertCols.push(col);
            values.push(`$${params.length}`);
        };

        if (messageCol) push(messageCol, message);
        if (typeCol) push(typeCol, type);
        if (refCol) push(refCol, referenceId);
        if (readCol) push(readCol, false);

        const result = await db.query(
            `INSERT INTO notifications (${insertCols.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`,
            params
        );

        const raw = result.rows[0] || {};
        const notification = {
            ...raw,
            message: messageCol ? raw[messageCol] : message,
            type: typeCol ? raw[typeCol] : type,
            reference_id: refCol ? raw[refCol] : referenceId,
            is_read: readCol ? raw[readCol] : false
        };

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
