// Halan Users Routes
// Partner user management (for supervisors and owners)

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// Middleware to authenticate partner users
const authenticatePartner = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'التوكن غير صالح' });
    }
};

// Get all partner users (filtered by role)
router.get('/', authenticatePartner, async (req, res) => {
    try {
        const { role, supervisorId } = req.query;

        // Base query - adjusted for PostgreSQL
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
            const userType = role === 'courier' ? 'partner_courier' :
                role === 'supervisor' ? 'partner_supervisor' :
                    role === 'owner' ? 'partner_owner' : null;
            if (userType) {
                params.push(userType);
                query += ` AND u.user_type = $${params.length}`;
            }
        }

        if (supervisorId) {
            params.push(parseInt(supervisorId));
            query += ` AND EXISTS (SELECT 1 FROM courier_supervisors sub_cs WHERE sub_cs.courier_id = u.id AND sub_cs.supervisor_id = $${params.length})`;
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC';

        const result = await pool.query(query, params);

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
            supervisorId: (user.supervisor_ids && user.supervisor_ids.length > 0) ? user.supervisor_ids[0] : null,
            createdAt: user.created_at
        }));

        res.json({ success: true, data: users });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Get single user by ID
router.get('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT id, name, username, email, phone, avatar, user_type, is_available, created_at
             FROM users WHERE id = $1 AND user_type LIKE 'partner_%'`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                role: user.user_type.replace('partner_', ''),
                isAvailable: user.is_available
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Update courier availability
router.patch('/:id/availability', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAvailable } = req.body;

        await pool.query(
            'UPDATE users SET is_available = $1 WHERE id = $2',
            [isAvailable, id]
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('driver-status-changed', {
                driverId: id,
                status: isAvailable ? 'online' : 'offline'
            });
            console.log(`📢 Socket: Driver ${id} availability changed to ${isAvailable}`);
        }

        res.json({ success: true, message: 'تم تحديث الحالة' });

    } catch (error) {
        console.error('Update availability error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Update User Profile (PUT)
router.put('/:id', authenticatePartner, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name_ar, username, email, phone, avatar, oldPassword, newPassword } = req.body;

        const userCheck = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }
        const currentUser = userCheck.rows[0];

        let passwordHash = currentUser.password_hash;
        if (newPassword) {
            if (!oldPassword) {
                return res.status(400).json({ success: false, error: 'يجب إدخال كلمة المرور الحالية' });
            }
            const isMatch = await bcrypt.compare(oldPassword, currentUser.password_hash);
            if (!isMatch) {
                return res.status(400).json({ success: false, error: 'كلمة المرور الحالية غير صحيحة' });
            }
            passwordHash = await bcrypt.hash(newPassword, 10);
        }

        const updates = [];
        const values = [];
        let counter = 1;

        if (name_ar) { updates.push(`name = $${counter++}`); values.push(name_ar); }
        if (username) { updates.push(`username = $${counter++}`); values.push(username); }
        if (email) { updates.push(`email = $${counter++}`); values.push(email); }
        if (phone) { updates.push(`phone = $${counter++}`); values.push(phone); }
        if (avatar !== undefined) { updates.push(`avatar = $${counter++}`); values.push(avatar); }
        if (newPassword) { updates.push(`password_hash = $${counter++}`); values.push(passwordHash); }

        if (updates.length === 0) {
            client.release();
            return res.json({ success: true, message: 'لم يتم تغيير أي بيانات', data: currentUser });
        }

        values.push(id);
        const updateQuery = `
            UPDATE users 
            SET ${updates.join(', ')} 
            WHERE id = $${counter} 
            RETURNING id, name, username, email, phone, avatar, user_type
        `;

        const result = await client.query(updateQuery, values);

        client.release();

        const updatedUser = result.rows[0];
        res.json({
            success: true,
            message: 'تم تحديث البيانات بنجاح',
            data: {
                ...updatedUser,
                name_ar: updatedUser.name,
                role: updatedUser.user_type.replace('partner_', '')
            }
        });

    } catch (error) {
        client.release();
        console.error('Update user error:', error);
        if (error.code === '23505') {
            if (error.constraint.includes('username')) return res.status(400).json({ success: false, error: 'اسم المستخدم محجوز' });
            if (error.constraint.includes('email')) return res.status(400).json({ success: false, error: 'البريد الإلكتروني محجوز' });
            if (error.constraint.includes('phone')) return res.status(400).json({ success: false, error: 'رقم الهاتف محجوز' });
        }
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء التحديث' });
    }
});

// Delete user
router.delete('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.user;

        console.log(`🗑️ Delete Request: Target ID ${id}, Requested by ${role}`);

        // Security Check: Only 'owner' can delete users
        // Note: Check if the role is 'owner' (from token shortcut) or 'partner_owner' (full type)
        if (role !== 'owner' && role !== 'partner_owner') {
            console.warn(`⛔ Unauthorized delete attempt by ${role}`);
            return res.status(403).json({ success: false, error: 'عذراً، هذا الإجراء مسموح للمالك فقط' });
        }

        // 1. Unassign from orders (Set courier_id or supervisor_id to NULL) to prevent PK violations
        // This keeps the order history but removes the deleted user reference
        await pool.query('UPDATE delivery_orders SET courier_id = NULL WHERE courier_id = $1', [id]);
        await pool.query('UPDATE delivery_orders SET supervisor_id = NULL WHERE supervisor_id = $1', [id]);

        // 2. Delete supervisor associations
        await pool.query('DELETE FROM courier_supervisors WHERE courier_id = $1 OR supervisor_id = $1', [id]);

        // 3. Delete user
        const result = await pool.query('DELETE FROM users WHERE id = $1 AND user_type LIKE \'partner_%\' RETURNING id', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        // إعلام الشاشات الحية بحذف المستخدم ليختفي فوراً
        const io = req.app.get('io');
        if (io) {
            io.emit('user-deleted', { id: id, role: 'partner' });
            io.emit('driver-status-changed', { driverId: id, status: 'offline' }); // لإزالته من الخريط
        }

        console.log(`✅ User ${id} deleted successfully`);
        res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر أثناء الحذف: ' + error.message });
    }
});

module.exports = router;
