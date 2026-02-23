const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * PRODUCTION-GRADE ADMIN CONTROLLER
 * Handles moderation, analytics, and audit log visibility.
 */

// 1. Dashboard Analytics (High Speed Aggregations)
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM providers) as total_providers,
                (SELECT COUNT(*) FROM bookings) as total_bookings,
                (SELECT SUM(price) FROM bookings WHERE status = 'completed') as total_revenue,
                (SELECT COUNT(*) FROM complaints WHERE status = 'pending') as pending_complaints
        `);

        // Get bookings by status for chart
        const statusResult = await db.query(`
            SELECT status, COUNT(*) as count 
            FROM bookings 
            GROUP BY status
        `);

        res.json({
            summary: stats.rows[0],
            bookingStats: statusResult.rows
        });
    } catch (error) {
        logger.error('[Admin] Stats Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// 2. User Moderation (Ban/Unban)
router.patch('/users/:id/ban', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isBanned } = req.body;

        await db.query('UPDATE users SET is_banned = $1 WHERE id = $2', [isBanned, id]);

        logger.info(`🚨 User Moderation: ${isBanned ? 'BANNED' : 'UNBANNED'} user ${id} by admin ${req.user.id}`);

        res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'} successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Moderation failed' });
    }
});

// 3. Complaints Management
router.get('/complaints', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.*, u.name as user_name, u.email as user_email
            FROM complaints c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

router.patch('/complaints/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        await db.query('UPDATE complaints SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ message: 'Complaint status updated' });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// 4. Audit Log Viewer (Read from file system for security)
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    try {
        const logPath = path.join(__dirname, '../../logs/combined.log');
        const data = await fs.readFile(logPath, 'utf8');

        // Parse last 100 logs
        const logs = data.split('\n')
            .filter(line => line.trim())
            .map(line => {
                try { return JSON.parse(line); }
                catch (e) { return { raw: line }; }
            })
            .reverse()
            .slice(0, 100);

        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read audit logs' });
    }
});

module.exports = router;
