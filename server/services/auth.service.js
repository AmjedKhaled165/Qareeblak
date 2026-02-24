const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

class AuthService {
    generateToken(user, isGuest = false) {
        return jwt.sign(
            { id: user.id, email: user.email, type: user.user_type, isGuest },
            JWT_SECRET,
            { expiresIn: isGuest ? '30d' : '7d' }
        );
    }

    async registerUser({ name, email, password }) {
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            throw new AppError('البريد الإلكتروني مسجل مسبقاً', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        // Force user_type to 'customer' to prevent mass assignment (privilege escalation)
        const result = await db.query(
            'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, name, email, user_type',
            [name, email, hashedPassword, 'customer']
        );

        const user = result.rows[0];
        const token = this.generateToken(user);

        return { user, token };
    }

    async loginUser(email, password) {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            throw new AppError('بيانات الدخول غير صحيحة', 401);
        }

        const user = result.rows[0];

        // Security: Prevent login for banned users
        if (user.is_banned) {
            throw new AppError('تم حظر حسابك لمخالفة القوانين، يرجى التواصل مع الإدارة', 403);
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            // Anti-brute force: you could implement lockout here
            throw new AppError('بيانات الدخول غير صحيحة', 401);
        }

        const token = this.generateToken(user);

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                type: user.user_type,
                phone: user.phone,
                avatar: user.avatar
            },
            token
        };
    }

    async guestLogin() {
        // Limitation: Guest users can accumulate. In production, consider pruning old guests.
        const guestId = Math.floor(100000 + Math.random() * 900000);
        const email = `guest_${Date.now()}_${guestId}@qareeblak.com`;
        const tempPassword = `pwd_${guestId}_${Math.random()}`;
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        const name = `زائر ${guestId}`;

        const result = await db.query(
            'INSERT INTO users (name, email, password, user_type) VALUES ($1, $2, $3, $4) RETURNING id, name, email, user_type',
            [name, email, hashedPassword, 'customer']
        );

        const user = result.rows[0];
        const token = this.generateToken(user, true);

        return { user: { id: user.id, name: user.name, email: user.email, type: user.user_type, isGuest: true }, token };
    }

    async forgotPassword(email) {
        const userRes = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            // Security: Don't reveal if email exists, just say "If it exists, check your email"
            return true;
        }

        const userId = userRes.rows[0].id;
        // Generate a 6-digit OTP OR a long token. For mobile, OTP is better.
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        // Clean old tokens
        await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt]
        );

        // In production: Send email here.
        logger.info(`Password reset token for ${email}: ${token}`);
        return true;
    }

    async resetPassword(token, newPassword) {
        const tokenRes = await db.query(
            'SELECT user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (tokenRes.rows.length === 0) {
            throw new AppError('الرمز غير صحيح أو منتهي الصلاحية', 400);
        }

        const userId = tokenRes.rows[0].user_id;
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

        return true;
    }

    async updateProfile(userId, data) {
        const { name, email, phone, avatar, oldPassword, newPassword } = data;
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

        if (userResult.rows.length === 0) {
            throw new AppError('المستخدم غير موجود', 404);
        }
        const currentUser = userResult.rows[0];

        // Prepare update
        const fields = [];
        const params = [];
        let i = 1;

        if (name) {
            fields.push(`name = $${i++}`);
            params.push(name);
        }

        if (phone) {
            fields.push(`phone = $${i++}`);
            params.push(phone);
        }

        if (avatar !== undefined) {
            fields.push(`avatar = $${i++}`);
            params.push(avatar);
        }

        if (email && email !== currentUser.email) {
            const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
            if (emailCheck.rows.length > 0) {
                throw new AppError('البريد الإلكتروني مستخدم بالفعل مسبقاً', 400);
            }
            fields.push(`email = $${i++}`);
            params.push(email);
        }

        if (newPassword) {
            if (!oldPassword) throw new AppError('يجب إدخال كلمة المرور الحالية', 400);

            const isMatch = await bcrypt.compare(oldPassword, currentUser.password);
            if (!isMatch) throw new AppError('كلمة المرور الحالية غير صحيحة', 400);

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            fields.push(`password = $${i++}`);
            params.push(hashedPassword);
        }

        if (fields.length === 0) return currentUser;

        params.push(userId);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, phone, avatar, user_type`;

        const result = await db.query(query, params);
        return result.rows[0];
    }

    async submitProviderRequest({ name, email, password, phone, category, location }) {
        const existingUser = await db.query('SELECT id, user_type FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];
            if (user.user_type === 'admin' || user.user_type === 'owner') {
                throw new AppError('لا يمكن استخدام هذا البريد الإلكتروني.', 400);
            }
            const existingProvider = await db.query('SELECT id FROM providers WHERE user_id = $1', [user.id]);
            if (existingProvider.rows.length > 0) {
                throw new AppError('الحساب موجود مسبقاً ولديه ملف مقدم خدمة. يمكنك تسجيل الدخول.', 400);
            }
        }

        const existing = await db.query('SELECT id, status FROM requests WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            const status = existing.rows[0].status;
            if (status === 'pending') {
                throw new AppError('طلبك قيد المراجعة من الإدارة. يرجى الانتظار.', 400);
            } else if (status === 'approved') {
                const providerExists = await db.query('SELECT id FROM providers WHERE email = $1', [email]);
                if (providerExists.rows.length > 0) {
                    throw new AppError('تم قبول طلبك مسبقاً. يمكنك تسجيل الدخول مباشرة.', 400);
                }
                await db.query('DELETE FROM requests WHERE email = $1', [email]);
            } else if (status === 'rejected') {
                await db.query('DELETE FROM requests WHERE email = $1', [email]);
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        await db.query(
            `INSERT INTO requests (name, email, password, phone, category, location, status) 
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
            [name, email, hashedPassword, phone, category, location]
        );
    }

    async getAllRequests() {
        const result = await db.query(
            `SELECT id, name, email, phone, category, location, status, submitted_at as date 
             FROM requests 
             ORDER BY submitted_at DESC`
        );
        return result.rows;
    }

    async approveRequest(id) {
        const requestResult = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const request = requestResult.rows[0];
        if (request.status !== 'pending') {
            throw new AppError('تم معالجة هذا الطلب مسبقاً', 400);
        }

        const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [request.email]);
        let userId;

        if (checkUser.rows.length > 0) {
            userId = checkUser.rows[0].id;
            await db.query("UPDATE users SET user_type = 'provider' WHERE id = $1", [userId]);
        } else {
            const userResult = await db.query(
                `INSERT INTO users (name, email, password, user_type) 
                 VALUES ($1, $2, $3, 'provider') 
                 RETURNING id`,
                [request.name, request.email, request.password]
            );
            userId = userResult.rows[0].id;
        }

        await db.query(
            `INSERT INTO providers (user_id, name, email, category, location, phone, is_approved) 
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
            [userId, request.name, request.email, request.category, request.location, request.phone]
        );

        await db.query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);
    }

    async rejectRequest(id) {
        const requestResult = await db.query('SELECT * FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            throw new AppError('الطلب غير موجود', 404);
        }

        if (requestResult.rows[0].status !== 'pending') {
            throw new AppError('تم معالجة هذا الطلب مسبقاً', 400);
        }

        await db.query("UPDATE requests SET status = 'rejected' WHERE id = $1", [id]);
    }
}

module.exports = new AuthService();
