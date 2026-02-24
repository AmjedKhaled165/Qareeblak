const jwt = require('jsonwebtoken');
const db = require('../db');

// 🚨 CRITICAL: Crash on missing secret (Security Hardening)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('🔥 FATAL ERROR: JWT_SECRET IS MISSING. SERVER REFUSES TO START.');
    process.exit(1);
}

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
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch fresh user data to ensure account hasn't been banned/deleted
        const result = await db.query(
            'SELECT id, name, email, user_type, role, phone, avatar, is_banned FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'المستخدم غير موجود أو تم حذفه' });
        }

        const user = result.rows[0];

        // Security: Instantly kick out banned users without waiting for token expiry
        if (user.is_banned) {
            return res.status(403).json({ error: 'لقد تم حظر حسابك لمخالفة القوانين' });
        }

        req.user = user;
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
        return res.status(403).json({ error: 'غير مصرح - للمقدمين فقط' });
    }
    next();
};

/**
 * Middleware to check if user is a Halan Partner, Courier, or Admin
 */
const isPartnerOrAdmin = (req, res, next) => {
    const type = req.user.user_type;
    const partnerTypes = ['partner_owner', 'partner_supervisor', 'partner_courier', 'courier', 'admin'];

    if (!req.user || !partnerTypes.includes(type)) {
        return res.status(403).json({ error: 'غير مصرح - خاص بشركاء التوصيل' });
    }
    next();
};

/**
 * Enterprise Socket.io Authentication Middleware
 * Prevents unauthenticated sniffing and impersonation on the WebSocket Transport Layer.
 */
const verifySocketToken = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
        if (!token) return next(new Error('Authentication error: Token missing'));

        const decoded = jwt.verify(token, JWT_SECRET);

        const result = await db.query(
            'SELECT id, name, user_type, is_banned FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0 || result.rows[0].is_banned) {
            return next(new Error('Authentication error: Invalid or banned user'));
        }

        socket.user = result.rows[0];
        next();
    } catch (error) {
        next(new Error('Authentication error: Invalid Token'));
    }
};

module.exports = {
    verifyToken,
    isAdmin,
    isProviderOrAdmin,
    isPartnerOrAdmin,
    verifySocketToken
};
