const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not defined in production environment');
    process.exit(1);
}

const fallbackSecret = 'halan-secret-key-2026'; // Match existing fallback for now but warn
const secret = JWT_SECRET || fallbackSecret;

/**
 * Middleware to verify JWT token and attach user to request
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, secret);
        
        // Fetch fresh user data to ensure account hasn't been banned/deleted
        const result = await db.query(
            'SELECT id, name, email, user_type FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'المستخدم غير موجود أو تم حذفه' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('[Auth] Token verification failed:', error.message);
        return res.status(401).json({ error: 'جلسة غير صالحة - يرجى إعادة تسجيل الدخول' });
    }
};

/**
 * Middleware to check if user has admin privileges
 */
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.user_type !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح - تتطلب صلاحيات مسئول' });
    }
    next();
};

/**
 * Middleware to check if user is a provider or admin
 */
const isProviderOrAdmin = (req, res, next) => {
    if (!req.user || (req.user.user_type !== 'provider' && req.user.user_type !== 'admin')) {
        return res.status(403).json({ error: 'غير مصرح - تتطلب صلاحيات مقدم خدمة' });
    }
    next();
};

/**
 * Middleware to check if user is an owner OR admin (God Mode)
 * Owner role bypasses all ownership checks
 */
const isOwnerOrAdmin = (req, res, next) => {
    if (!req.user || (req.user.user_type !== 'owner' && req.user.user_type !== 'admin')) {
        return res.status(403).json({ error: 'غير مصرح - تتطلب صلاحيات مسئول أعلى' });
    }
    next();
};

module.exports = {
    verifyToken,
    isAdmin,
    isProviderOrAdmin,
    isOwnerOrAdmin
};
