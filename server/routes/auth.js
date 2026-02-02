const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, userType = 'customer' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        // Check if user exists
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await db.query(
            'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, name, email, user_type',
            [name, email, hashedPassword, userType]
        );

        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, type: user.user_type },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'تم التسجيل بنجاح',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                type: user.user_type
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'حدث خطأ في التسجيل' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبين' });
        }

        // Find user
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        const user = result.rows[0];

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, type: user.user_type },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'تم تسجيل الدخول بنجاح',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                type: user.user_type
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' });
    }
});

// Get current user (requires token)
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'غير مصرح' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await db.query(
            'SELECT id, name, email, user_type FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            type: user.user_type
        });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(401).json({ error: 'رمز المصادقة غير صالح' });
    }
});

// Submit provider request (NO auto-approval - requires admin)
router.post('/provider-request', async (req, res) => {
    try {
        const { name, email, password, phone, category, location } = req.body;

        if (!name || !email || !password || !category) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        // Check if email already registered as user
        const existingUser = await db.query('SELECT id, user_type FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            // Check if they are a provider that still exists
            const existingProvider = await db.query('SELECT id FROM providers WHERE email = $1', [email]);
            if (existingProvider.rows.length > 0) {
                return res.status(400).json({ error: 'الحساب موجود مسبقاً. يمكنك تسجيل الدخول مباشرة.' });
            }
            // User exists but provider was deleted - allow re-registration by deleting the user
            await db.query('DELETE FROM users WHERE email = $1', [email]);
        }

        // Check if request already exists
        const existing = await db.query('SELECT id, status FROM requests WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            const status = existing.rows[0].status;
            if (status === 'pending') {
                return res.status(400).json({ error: 'طلبك قيد المراجعة من الإدارة. يرجى الانتظار.' });
            } else if (status === 'approved') {
                // Check if provider still exists
                const providerExists = await db.query('SELECT id FROM providers WHERE email = $1', [email]);
                if (providerExists.rows.length > 0) {
                    return res.status(400).json({ error: 'تم قبول طلبك مسبقاً. يمكنك تسجيل الدخول مباشرة.' });
                }
                // Provider was deleted after approval - delete old request and allow re-application
                await db.query('DELETE FROM requests WHERE email = $1', [email]);
            } else if (status === 'rejected') {
                // Request was rejected - delete old request and allow re-application
                await db.query('DELETE FROM requests WHERE email = $1', [email]);
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO requests (name, email, password, phone, category, location, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
            [name, email, hashedPassword, phone, category, location]
        );

        res.status(201).json({
            message: 'تم تقديم طلبك بنجاح! سيتم مراجعته من الإدارة.',
            status: 'pending'
        });
    } catch (error) {
        console.error('Provider request error:', error);
        res.status(500).json({ error: 'حدث خطأ في تقديم الطلب' });
    }
});

// Get all pending requests (Admin)
router.get('/requests', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, email, phone, category, location, status, submitted_at as date 
             FROM requests 
             ORDER BY submitted_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الطلبات' });
    }
});

// Approve provider request (Admin)
router.post('/requests/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;

        const requestResult = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'تم معالجة هذا الطلب مسبقاً' });
        }

        // Create user
        const userResult = await db.query(
            `INSERT INTO users (name, email, password, user_type) 
             VALUES ($1, $2, $3, 'provider') 
             ON CONFLICT (email) DO UPDATE SET user_type = 'provider'
             RETURNING id`,
            [request.name, request.email, request.password]
        );
        const userId = userResult.rows[0].id;

        // Create provider
        await db.query(
            `INSERT INTO providers (user_id, name, email, category, location, phone, is_approved) 
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
            [userId, request.name, request.email, request.category, request.location, request.phone]
        );

        // Update request status
        await db.query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);

        res.json({ message: 'تم قبول الطلب بنجاح' });
    } catch (error) {
        console.error('Approve request error:', error);
        res.status(500).json({ error: 'حدث خطأ في قبول الطلب' });
    }
});

// Reject provider request (Admin)
router.post('/requests/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;

        const requestResult = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'الطلب غير موجود' });
        }

        if (requestResult.rows[0].status !== 'pending') {
            return res.status(400).json({ error: 'تم معالجة هذا الطلب مسبقاً' });
        }

        await db.query("UPDATE requests SET status = 'rejected' WHERE id = $1", [id]);

        res.json({ message: 'تم رفض الطلب' });
    } catch (error) {
        console.error('Reject request error:', error);
        res.status(500).json({ error: 'حدث خطأ في رفض الطلب' });
    }
});

module.exports = router;
