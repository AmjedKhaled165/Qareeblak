const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { registerSchema, loginSchema, validate } = require('../middleware/validation');
const { verifyToken, isAdmin } = require('../middleware/auth');
const auditLogger = require('../middleware/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// Register new user
router.post('/register', validate(registerSchema), async (req, res) => {
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
            JWT_SECRET,
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
router.post('/login', validate(loginSchema), async (req, res) => {
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

        // Check if user is banned (Moderation)
        if (user.is_banned) {
            return res.status(403).json({ error: 'تم حظر حسابك لمخالفة القوانين، يرجى التواصل مع الإدارة' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, type: user.user_type },
            JWT_SECRET,
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

// Guest Login (Auto-create temporary user)
router.post('/guest-login', async (req, res) => {
    try {
        const guestId = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
        const email = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}@qareeblak.com`;
        const password = await bcrypt.hash(`guest_${Date.now()}`, 10);
        const name = `زائر ${guestId}`;

        // Create guest user
        const result = await db.query(
            'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, name, email, user_type',
            [name, email, password, 'customer']
        );

        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, type: user.user_type, isGuest: true },
            JWT_SECRET,
            { expiresIn: '30d' } // Long expiry for guest sessions
        );

        res.json({
            message: 'تم الدخول كزائر بنجاح',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                type: user.user_type,
                isGuest: true
            },
            token
        });
    } catch (error) {
        console.error('Guest login error:', error);
        res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول كزائر' });
    }
});

// Get current user (requires token)
router.get('/me', verifyToken, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'خطأ في التحقق من المصادقة' });
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

// Get all pending requests (Admin Only)
router.get('/requests', verifyToken, isAdmin, async (req, res) => {
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

// Approve provider request (Admin Only)
router.post('/requests/:id/approve', verifyToken, isAdmin, async (req, res) => {
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

// Reject provider request (Admin Only)
router.post('/requests/:id/reject', verifyToken, isAdmin, async (req, res) => {
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

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const { name, email, phone, avatar, oldPassword, newPassword } = req.body;

        // Get current user
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }
        const currentUser = userResult.rows[0];

        // Prepare update values
        let updateQuery = 'UPDATE users SET name = $1, phone = $2, avatar = $3';
        let queryParams = [name || currentUser.name, phone || currentUser.phone, avatar || currentUser.avatar];
        let paramIndex = 4;

        // Handle Email Change
        if (email && email !== currentUser.email) {
            // Check if email taken
            const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
            if (emailCheck.rows.length > 0) {
                return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
            }
            updateQuery += `, email = $${paramIndex}`;
            queryParams.push(email);
            paramIndex++;
        }

        // Handle Password Change
        if (newPassword) {
            if (!oldPassword) {
                return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية لتعيين كلمة مرور جديدة' });
            }

            const isMatch = await bcrypt.compare(oldPassword, currentUser.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateQuery += `, password = $${paramIndex}`;
            queryParams.push(hashedPassword);
            paramIndex++;
        }

        updateQuery += ` WHERE id = $${paramIndex} RETURNING id, name, email, phone, avatar, user_type`;
        queryParams.push(userId);

        const result = await db.query(updateQuery, queryParams);
        const updatedUser = result.rows[0];

        res.json({
            success: true,
            message: 'تم تحديث البيانات بنجاح',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'حدث خطأ في تحديث البيانات' });
    }
});

module.exports = router;
