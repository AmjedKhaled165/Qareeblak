const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * PRODUCTION-GRADE HALAN USER MANAGEMENT
 */

// Get all partner users (filtered by role)
router.get('/', verifyToken, async (req, res) => {
    try {
        const { role, supervisorId } = req.query;

        let query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.phone, u.avatar, u.user_type, u.is_available, u.created_at,
                array_agg(cs.supervisor_id) FILTER (WHERE cs.supervisor_id IS NOT NULL) as supervisor_ids
            FROM users u
            LEFT JOIN courier_supervisors cs ON u.id = cs.courier_id
            WHERE u.user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        `;
        const params = [];

        if (role) {
            const userType = `partner_${role}`;
            params.push(userType);
            query += ` AND u.user_type = $${params.length}`;
        }

        if (supervisorId) {
            params.push(parseInt(supervisorId));
            query += ` AND EXISTS (SELECT 1 FROM courier_supervisors sub_cs WHERE sub_cs.courier_id = u.id AND sub_cs.supervisor_id = $${params.length})`;
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC';

        const result = await db.query(query, params);

        const users = result.rows.map(user => ({
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            role: user.user_type.replace('partner_', ''),
            isAvailable: user.is_available,
            supervisorIds: user.supervisor_ids || [],
            createdAt: user.created_at
        }));

        res.json({ success: true, data: users });
    } catch (error) {
        logger.error('[Halan-Users] Get Partners Error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Update courier availability
router.patch('/:id/availability', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAvailable } = req.body;

        // Security: Self or Admin/Supervisor
        if (req.user.id.toString() !== id.toString() && !['partner_owner', 'partner_supervisor', 'admin'].includes(req.user.user_type)) {
            return res.status(403).json({ success: false, error: 'غير مصرح لك بتغيير حالة مستخدم آخر' });
        }

        await db.query('UPDATE users SET is_available = $1 WHERE id = $2', [isAvailable, id]);

        const io = req.app.get('io');
        if (io) {
            io.emit('driver-status-changed', {
                driverId: id,
                status: isAvailable ? 'online' : 'offline'
            });
        }

        res.json({ success: true, message: 'تم تحديث الحالة' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Update User Profile
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, email, phone, avatar, oldPassword, newPassword } = req.body;

        // Security: Self or Admin/Owner only
        if (req.user.id.toString() !== id.toString() && req.user.user_type !== 'partner_owner' && req.user.user_type !== 'admin') {
            return res.status(403).json({ success: false, error: 'غير مصرح لك' });
        }

        const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'المستخدم غير موجود' });

        const currentUser = userCheck.rows[0];

        let passwordHash = currentUser.password;
        if (newPassword) {
            const isMatch = await bcrypt.compare(oldPassword, currentUser.password);
            if (!isMatch) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
            passwordHash = await bcrypt.hash(newPassword, 10);
        }

        const updates = [];
        const values = [];
        let counter = 1;

        if (name) { updates.push(`name = $${counter++}`); values.push(name); }
        if (username) { updates.push(`username = $${counter++}`); values.push(username); }
        if (email) { updates.push(`email = $${counter++}`); values.push(email); }
        if (phone) { updates.push(`phone = $${counter++}`); values.push(phone); }
        if (avatar) { updates.push(`avatar = $${counter++}`); values.push(avatar); }
        if (newPassword) { updates.push(`password = $${counter++}`); values.push(passwordHash); }

        if (updates.length > 0) {
            values.push(id);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${counter}`, values);
        }

        res.json({ success: true, message: 'تم تحديث البيانات بنجاح' });
    } catch (error) {
        logger.error('[Halan-Users] Update Error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete user
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Security Check: Only 'owner' or 'admin' can delete users
        if (req.user.user_type !== 'partner_owner' && req.user.user_type !== 'admin') {
            return res.status(403).json({ success: false, error: 'عذراً، هذا الإجراء مسموح للمالك فقط' });
        }

        // 1. Unassign from orders
        await db.query('UPDATE delivery_orders SET courier_id = NULL WHERE courier_id = $1', [id]);
        await db.query('UPDATE delivery_orders SET supervisor_id = NULL WHERE supervisor_id = $1', [id]);

        // 2. Delete associations
        await db.query('DELETE FROM courier_supervisors WHERE courier_id = $1 OR supervisor_id = $1', [id]);

        // 3. Delete user
        const result = await db.query('DELETE FROM users WHERE id = $1 AND user_type LIKE \'partner_%\' RETURNING id', [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });

        const io = req.app.get('io');
        if (io) io.emit('user-deleted', { id: id, role: 'partner' });

        res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        logger.error('[Halan-Users] Delete Error:', error);
        res.status(500).json({ error: 'Deletion failed' });
    }
});

module.exports = router;
