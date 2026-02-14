const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// Login for partners (owner, supervisor, courier)
router.post('/login', async (req, res) => {
    try {
        let { identifier, password } = req.body;

        if (identifier) identifier = identifier.trim().toLowerCase();
        if (password) password = password.trim();

        if (!identifier || !password) {
            return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
        }

        // Find user by username or email
        const result = await db.query(
            `SELECT * FROM users 
             WHERE (LOWER(username) = $1 OR LOWER(email) = $1) 
             AND user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')`,
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        const user = result.rows[0];

        // 🛡️ SECURITY: Check if user is banned
        if (user.is_banned) {
            return res.status(403).json({ success: false, error: 'تم حظر حسابك لمخالفة القوانين، يرجى التواصل مع الإدارة' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // Map user_type to role for frontend compatibility
        const role = user.user_type.replace('partner_', '');

        // Generate JWT (Unified Payload)
        const token = jwt.sign(
            { id: user.id, email: user.email, user_type: user.user_type },
            JWT_SECRET,
            { expiresIn: '15d' }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    name_ar: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: role
                },
                token
            }
        });

    } catch (error) {
        logger.error('[Halan-Auth] Login Error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Get current user info (Hardened with verifyToken)
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = req.user;
        const role = user.user_type.replace('partner_', '');

        res.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                name_ar: user.name,
                email: user.email,
                phone: user.phone,
                role: role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Owner-only registration for new team members
router.post('/register', verifyToken, async (req, res) => {
    try {
        const { name, username, email, phone, password, role, supervisorId } = req.body;

        // Verify requester is owner
        if (req.user.user_type !== 'partner_owner' && req.user.user_type !== 'admin') {
            return res.status(403).json({ success: false, error: 'يسمح للمالك فقط بإضافة مستخدمين' });
        }

        if (!username || !password || !role) {
            return res.status(400).json({ success: false, error: 'يرجى إكمال البيانات الأساسية' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userType = `partner_${role}`;

        const result = await db.query(
            `INSERT INTO users (name, username, email, phone, password, user_type) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [name, username, email || null, phone || null, hashedPassword, userType]
        );

        const newUserId = result.rows[0].id;

        // Link courier to supervisor if provided
        if (role === 'courier' && supervisorId) {
            await db.query(
                `INSERT INTO courier_supervisors (courier_id, supervisor_id) VALUES ($1, $2)`,
                [newUserId, supervisorId]
            );
        }

        res.status(201).json({
            success: true,
            message: 'تم إضافة المستخدم بنجاح',
            userId: newUserId
        });

    } catch (error) {
        logger.error('[Halan-Auth] Registration error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ success: false, error: 'البيانات (اسم المستخدم أو البريد أو الهاتف) مسجلة لمستخدم آخر' });
        }
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء إضافة المستخدم' });
    }
});

module.exports = router;

module.exports = router;
