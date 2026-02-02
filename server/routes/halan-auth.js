// Halan Authentication Routes
// Partner login and user management

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// Login for partners (owner, supervisor, courier)
router.post('/login', async (req, res) => {
    try {
        let { identifier, password } = req.body;

        if (identifier) identifier = identifier.trim();
        if (password) password = password.trim();

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                error: 'يرجى إدخال اسم المستخدم وكلمة المرور'
            });
        }

        // Find user by username or email
        console.log(`🔍 Partner login attempt for identifier: "${identifier}"`);
        const result = await pool.query(
            `SELECT * FROM users 
             WHERE (username = $1 OR email = $1) 
             AND user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')`,
            [identifier]
        );

        if (result.rows.length === 0) {
            console.log(`❌ No partner user found with identifier: "${identifier}"`);
            return res.status(401).json({
                success: false,
                error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        const user = result.rows[0];
        console.log(`✅ Found user: ${user.name} (ID: ${user.id}, Role: ${user.user_type})`);

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        console.log(`🔑 Password verification result: ${validPassword}`);

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        // Map user_type to role for frontend
        let role = 'courier';
        if (user.user_type === 'partner_owner') role = 'owner';
        else if (user.user_type === 'partner_supervisor') role = 'supervisor';
        else if (user.user_type === 'partner_courier') role = 'courier';

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, role: role, username: user.username },
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
                    avatar: user.avatar,
                    role: role
                },
                token
            }
        });

    } catch (error) {
        console.error('Partner login error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Get current user info
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const result = await pool.query(
            'SELECT id, name, username, email, phone, avatar, user_type FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const user = result.rows[0];
        let role = 'courier';
        if (user.user_type === 'partner_owner') role = 'owner';
        else if (user.user_type === 'partner_supervisor') role = 'supervisor';

        res.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                name_ar: user.name,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                role: role
            }
        });

    } catch (error) {
        console.error('Get current user error:', error);
        res.status(401).json({ success: false, error: 'التوكن غير صالح' });
    }
});

// Owner-only registration for new team members
router.post('/register', async (req, res) => {
    try {
        const { name, username, email, phone, password, role, supervisorId } = req.body;
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify requester is owner
        if (decoded.role !== 'owner') {
            return res.status(403).json({ success: false, error: 'يسمح للمالك فقط بإضافة مستخدمين' });
        }

        if (!username || !password || !role) {
            return res.status(400).json({ success: false, error: 'يرجى إكمال البيانات الأساسية' });
        }

        // Check if username already exists
        const checkUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'اسم المستخدم موجود بالفعل' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userType = `partner_${role}`; // role: supervisor or courier

        // Handle optional fields (email/phone should be null if empty to avoid unique constraint issues)
        const emailValue = email && email.trim() !== '' ? email : null;
        const phoneValue = phone && phone.trim() !== '' ? phone : null;

        // Insert user
        const result = await pool.query(
            `INSERT INTO users (name, username, email, phone, password, user_type) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [name, username, emailValue, phoneValue, hashedPassword, userType]
        );

        const newUserId = result.rows[0].id;

        // If it's a courier and a supervisor is provided, link them
        if (role === 'courier' && supervisorId) {
            await pool.query(
                `INSERT INTO user_supervisors (user_id, supervisor_id) VALUES ($1, $2)`,
                [newUserId, supervisorId]
            );
        }

        res.status(201).json({
            success: true,
            message: 'تم إضافة المستخدم بنجاح',
            userId: newUserId
        });

    } catch (error) {
        console.error('Registration error:', error);

        // Handle Unique Violations (Username, Email, Phone)
        if (error.code === '23505') {
            if (error.constraint.includes('username')) {
                return res.status(400).json({ success: false, error: 'اسم المستخدم هذا محجوز مسبقاً، يرجى اختيار اسم آخر.' });
            }
            if (error.constraint.includes('email')) {
                return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل.' });
            }
            if (error.constraint.includes('phone')) {
                return res.status(400).json({ success: false, error: 'رقم الهاتف مسجل بالفعل لأحد المستخدمين.' });
            }
            return res.status(400).json({ success: false, error: 'توجد بيانات مكررة (الاسم أو الهاتف).' });
        }

        res.status(500).json({ success: false, error: 'حدث خطأ أثناء إضافة المستخدم' });
    }
});

module.exports = router;
