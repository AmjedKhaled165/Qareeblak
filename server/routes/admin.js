const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin, isOwnerOrAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

/**
 * GOD MODE ADMIN CONTROLLER
 * Full visibility and control over the entire system.
 * All mutating actions are logged to audit_actions table.
 */

// ============ Audit Helper ============
async function auditLog(adminId, action, entityType, entityId, details, oldValue, newValue, ip) {
    try {
        await db.query(
            `INSERT INTO audit_actions (admin_id, action, entity_type, entity_id, details, old_value, new_value, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [adminId, action, entityType, entityId, details, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, ip]
        );
    } catch (err) {
        logger.error('[Audit] Failed to log action:', err.message);
    }
}

// ============================================================
// 1. DASHBOARD ANALYTICS
// ============================================================
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
        const statusResult = await db.query(`SELECT status, COUNT(*) as count FROM bookings GROUP BY status`);
        res.json({ summary: stats.rows[0], bookingStats: statusResult.rows });
    } catch (error) {
        logger.error('[Admin] Stats Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// ============================================================
// 2. ORDERS — GOD MODE
// ============================================================

// GET /admin/orders — Paginated list with joins
router.get('/orders', verifyToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 25, status, type, search, sort = 'created_at', order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        let whereClause = '';
        const conditions = [];

        if (status) {
            params.push(status);
            conditions.push(`b.status = $${params.length}`);
        }
        if (type) {
            params.push(type);
            conditions.push(`b.order_type = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            const searchIdx = params.length;
            conditions.push(`(cu.name ILIKE $${searchIdx} OR cu.phone ILIKE $${searchIdx} OR CAST(b.id AS TEXT) ILIKE $${searchIdx})`);
        }

        if (conditions.length > 0) whereClause = 'WHERE ' + conditions.join(' AND ');

        // Validate sort column
        const allowedSorts = ['created_at', 'price', 'id', 'status'];
        const sortCol = allowedSorts.includes(sort) ? `b.${sort}` : 'b.created_at';
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

        const countQ = await db.query(`SELECT COUNT(*) FROM bookings b LEFT JOIN users cu ON b.user_id = cu.id ${whereClause}`, params);
        const total = parseInt(countQ.rows[0].count);

        params.push(parseInt(limit), offset);

        const result = await db.query(`
            SELECT b.*,
                cu.name as customer_name, cu.phone as customer_phone, cu.email as customer_email,
                pu.name as provider_name, pu.phone as provider_phone,
                cou.name as courier_name, cou.phone as courier_phone
            FROM bookings b
            LEFT JOIN users cu ON b.user_id = cu.id
            LEFT JOIN users pu ON b.provider_id = pu.id
            LEFT JOIN users cou ON b.courier_id = cou.id
            ${whereClause}
            ORDER BY ${sortCol} ${sortOrder}
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            orders: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        logger.error('[Admin] Orders Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// GET /admin/orders/:id — Full order detail
router.get('/orders/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT b.*,
                cu.name as customer_name, cu.phone as customer_phone, cu.email as customer_email,
                pu.name as provider_name, pu.phone as provider_phone,
                cou.name as courier_name, cou.phone as courier_phone
            FROM bookings b
            LEFT JOIN users cu ON b.user_id = cu.id
            LEFT JOIN users pu ON b.provider_id = pu.id
            LEFT JOIN users cou ON b.courier_id = cou.id
            WHERE b.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });

        // Get order items
        let items = [];
        try {
            const itemsResult = await db.query('SELECT * FROM booking_items WHERE booking_id = $1', [req.params.id]);
            items = itemsResult.rows;
        } catch (e) { /* booking_items table may not exist */ }

        res.json({ ...result.rows[0], items });
    } catch (error) {
        logger.error('[Admin] Order Detail Error:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// PATCH /admin/orders/:id/force-edit — God Mode edit (price, items, notes)
router.patch('/orders/:id/force-edit', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { price, delivery_fee, notes, items } = req.body;

        // Get old values for audit
        const old = await db.query('SELECT price, delivery_fee, notes FROM bookings WHERE id = $1', [id]);
        if (old.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });

        const updates = [];
        const values = [];
        let idx = 1;

        if (price !== undefined) { updates.push(`price = $${idx++}`); values.push(price); }
        if (delivery_fee !== undefined) { updates.push(`delivery_fee = $${idx++}`); values.push(delivery_fee); }
        if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }

        if (updates.length > 0) {
            values.push(id);
            await db.query(`UPDATE bookings SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, values);
        }

        // Update items if provided
        if (items && Array.isArray(items)) {
            try {
                await db.query('DELETE FROM booking_items WHERE booking_id = $1', [id]);
                for (const item of items) {
                    await db.query(
                        'INSERT INTO booking_items (booking_id, name, quantity, price) VALUES ($1, $2, $3, $4)',
                        [id, item.name, item.quantity, item.price]
                    );
                }
            } catch (e) { logger.warn('[Admin] Could not update booking items:', e.message); }
        }

        await auditLog(req.user.id, 'force_edit', 'order', id, `Force edited order #${id}`, old.rows[0], { price, delivery_fee, notes }, req.ip);

        res.json({ message: 'تم تعديل الطلب بنجاح ✅' });
    } catch (error) {
        logger.error('[Admin] Force Edit Error:', error);
        res.status(500).json({ error: 'فشل في تعديل الطلب' });
    }
});

// PATCH /admin/orders/:id/reassign — Reassign courier or provider
router.patch('/orders/:id/reassign', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { courier_id, provider_id } = req.body;

        const old = await db.query('SELECT courier_id, provider_id FROM bookings WHERE id = $1', [id]);
        if (old.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });

        const updates = [];
        const values = [];
        let idx = 1;
        if (courier_id !== undefined) { updates.push(`courier_id = $${idx++}`); values.push(courier_id); }
        if (provider_id !== undefined) { updates.push(`provider_id = $${idx++}`); values.push(provider_id); }

        if (updates.length > 0) {
            values.push(id);
            await db.query(`UPDATE bookings SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, values);
        }

        await auditLog(req.user.id, 'reassign', 'order', id, `Reassigned order #${id}`, old.rows[0], { courier_id, provider_id }, req.ip);

        // Notify via socket
        const io = req.app.get('io');
        if (io) io.emit('order_updated', { orderId: id, type: 'reassign' });

        res.json({ message: 'تم إعادة التعيين بنجاح ✅' });
    } catch (error) {
        logger.error('[Admin] Reassign Error:', error);
        res.status(500).json({ error: 'فشل في إعادة التعيين' });
    }
});

// PATCH /admin/orders/:id/force-status — Force override status
router.patch('/orders/:id/force-status', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;
        if (!status) return res.status(400).json({ error: 'يجب تحديد الحالة الجديدة' });

        const old = await db.query('SELECT status FROM bookings WHERE id = $1', [id]);
        if (old.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });

        await db.query('UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);

        await auditLog(req.user.id, 'force_status', 'order', id, `Force status: ${old.rows[0].status} → ${status}. Reason: ${reason || 'N/A'}`, { status: old.rows[0].status }, { status, reason }, req.ip);

        const io = req.app.get('io');
        if (io) io.emit('order_updated', { orderId: id, type: 'status_change', newStatus: status });

        res.json({ message: 'تم تغيير الحالة بنجاح ✅' });
    } catch (error) {
        logger.error('[Admin] Force Status Error:', error);
        res.status(500).json({ error: 'فشل في تغيير الحالة' });
    }
});

// DELETE /admin/orders/:id — Soft or hard delete
router.delete('/orders/:id', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { hard } = req.query;

        if (hard === 'true') {
            await db.query('DELETE FROM bookings WHERE id = $1', [id]);
        } else {
            await db.query("UPDATE bookings SET status = 'deleted', updated_at = NOW() WHERE id = $1", [id]);
        }

        await auditLog(req.user.id, 'delete', 'order', id, `${hard === 'true' ? 'Hard' : 'Soft'} deleted order #${id}`, null, null, req.ip);

        res.json({ message: 'تم حذف الطلب ✅' });
    } catch (error) {
        logger.error('[Admin] Delete Order Error:', error);
        res.status(500).json({ error: 'فشل في حذف الطلب' });
    }
});

// ============================================================
// 3. USERS — GOD MODE
// ============================================================

// GET /admin/users — Paginated user list
router.get('/users', verifyToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 25, type, search, banned } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        const conditions = [];

        if (type) {
            params.push(type);
            conditions.push(`u.user_type = $${params.length}`);
        }
        if (banned === 'true') {
            conditions.push('u.is_banned = true');
        }
        if (search) {
            params.push(`%${search}%`);
            const idx = params.length;
            conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone ILIKE $${idx})`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countQ = await db.query(`SELECT COUNT(*) FROM users u ${whereClause}`, params);
        const total = parseInt(countQ.rows[0].count);

        params.push(parseInt(limit), offset);
        const result = await db.query(`
            SELECT u.id, u.name, u.name_ar, u.email, u.phone, u.user_type, u.is_banned, u.is_online, u.created_at,
                   (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as total_bookings
            FROM users u
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            users: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        logger.error('[Admin] Users Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /admin/users/:id — Full profile
router.get('/users/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.*, 
                   (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as total_bookings
            FROM users u WHERE u.id = $1
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });
        const user = result.rows[0];
        delete user.password;
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// PATCH /admin/users/:id/ban — Ban or unban
router.patch('/users/:id/ban', verifyToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isBanned, reason } = req.body;

        await db.query('UPDATE users SET is_banned = $1 WHERE id = $2', [isBanned, id]);

        await auditLog(req.user.id, isBanned ? 'ban' : 'unban', 'user', id, `${isBanned ? 'Banned' : 'Unbanned'} user #${id}. Reason: ${reason || 'N/A'}`, null, { isBanned, reason }, req.ip);

        logger.info(`🚨 User Moderation: ${isBanned ? 'BANNED' : 'UNBANNED'} user ${id} by admin ${req.user.id}`);
        res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'} successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Moderation failed' });
    }
});

// PATCH /admin/users/:id/edit — Edit profile
router.patch('/users/:id/edit', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email } = req.body;

        const old = await db.query('SELECT name, phone, email FROM users WHERE id = $1', [id]);
        if (old.rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });

        const updates = [];
        const values = [];
        let idx = 1;
        if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
        if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone); }
        if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email); }

        if (updates.length > 0) {
            values.push(id);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
        }

        await auditLog(req.user.id, 'edit_profile', 'user', id, `Edited user #${id} profile`, old.rows[0], { name, phone, email }, req.ip);

        res.json({ message: 'تم تحديث بيانات المستخدم ✅' });
    } catch (error) {
        logger.error('[Admin] Edit User Error:', error);
        res.status(500).json({ error: 'فشل في تعديل بيانات المستخدم' });
    }
});

// POST /admin/users/:id/reset-password
router.post('/users/:id/reset-password', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, id]);

        await auditLog(req.user.id, 'reset_password', 'user', id, `Reset password for user #${id}`, null, null, req.ip);

        res.json({ message: 'تم إعادة تعيين كلمة المرور ✅' });
    } catch (error) {
        logger.error('[Admin] Reset Password Error:', error);
        res.status(500).json({ error: 'فشل في إعادة تعيين كلمة المرور' });
    }
});

// ============================================================
// 4. COURIERS — Available for Reassignment
// ============================================================
router.get('/couriers/available', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.name, u.phone, u.is_online,
                   (SELECT COUNT(*) FROM bookings WHERE courier_id = u.id AND status IN ('accepted', 'delivering', 'picked_up')) as active_orders
            FROM users u
            WHERE u.user_type = 'partner_courier'
              AND u.is_banned = false
            ORDER BY u.is_online DESC, u.name ASC
        `);
        res.json(result.rows);
    } catch (error) {
        logger.error('[Admin] Couriers Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch couriers' });
    }
});

// ============================================================
// 5. COMPLAINTS
// ============================================================
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

// ============================================================
// 6. AUDIT LOG — Database backed
// ============================================================
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 30, action, userId, dateFrom } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        const conditions = [];

        if (action) {
            params.push(action);
            conditions.push(`a.action = $${params.length}`);
        }
        if (userId) {
            params.push(parseInt(userId));
            conditions.push(`a.admin_id = $${params.length}`);
        }
        if (dateFrom) {
            params.push(dateFrom);
            conditions.push(`a.created_at >= $${params.length}::date`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countQ = await db.query(`SELECT COUNT(*) FROM audit_actions a ${whereClause}`, params);
        const total = parseInt(countQ.rows[0].count);

        params.push(parseInt(limit), offset);
        const result = await db.query(`
            SELECT a.*, u.name as admin_name
            FROM audit_actions a
            LEFT JOIN users u ON a.admin_id = u.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        res.json({
            logs: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        logger.error('[Admin] Audit Log Error:', error);
        // Fallback to file-based log if DB table not yet created
        try {
            const logPath = path.join(__dirname, '../../logs/combined.log');
            const data = await fs.readFile(logPath, 'utf8');
            const logs = data.split('\n')
                .filter(line => line.trim())
                .map(line => { try { return JSON.parse(line); } catch (e) { return { raw: line }; } })
                .reverse()
                .slice(0, 100);
            res.json({ logs, pagination: { page: 1, limit: 100, total: logs.length, totalPages: 1 } });
        } catch (fallbackErr) {
            res.status(500).json({ error: 'Failed to read audit logs' });
        }
    }
});

// ============================================================
// 7. AUDIT_ACTIONS TABLE MIGRATION (auto-create on first request)
// ============================================================
router.post('/setup-audit-table', verifyToken, isOwnerOrAdmin, async (req, res) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_actions (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER REFERENCES users(id),
                action VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50),
                entity_id INTEGER,
                details TEXT,
                old_value TEXT,
                new_value TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_actions_admin ON audit_actions(admin_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_actions_created ON audit_actions(created_at DESC)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_audit_actions_action ON audit_actions(action)');
        res.json({ message: 'Audit table created successfully ✅' });
    } catch (error) {
        logger.error('[Admin] Audit Table Setup Error:', error);
        res.status(500).json({ error: 'Failed to create audit table' });
    }
});

module.exports = router;
