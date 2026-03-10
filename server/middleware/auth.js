const jwt = require('jsonwebtoken');
const db = require('../db');
const { client: redisClient } = require('../utils/redis');
const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

// 🚨 CRITICAL: Crash on missing secret (Security Hardening)
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

// 🔑 [Big Tech] Secrets Rotation Pool
// Primary secret is first in the list. Verification checks all.
const SECRET_POOL = process.env.JWT_SECRET_POOL ? process.env.JWT_SECRET_POOL.split(',') : [JWT_SECRET];

if (!JWT_SECRET) {
    logger.error('🔥 FATAL ERROR: JWT_ACCESS_SECRET IS MISSING. SERVER REFUSES TO START.');
    process.exit(1);
}

/**
 * Validates a JWT against the secret pool (Zero-Downtime Rotation)
 */
function verifyJWT(token, type = 'access') {
    const pool = type === 'access' ? SECRET_POOL : [JWT_REFRESH_SECRET];
    let lastErr = null;

    for (const secret of pool) {
        try {
            return jwt.verify(token, secret);
        } catch (err) {
            lastErr = err;
            if (err.name === 'JsonWebTokenError' && err.message === 'invalid signature') continue;
            break; // Expired or other error - stop pool check
        }
    }
    throw lastErr;
}

// Cache TTL for user session data (60 seconds)
// Short enough to reflect bans quickly, long enough to dramatically cut DB queries
const USER_CACHE_TTL = 60;

// ==========================================
// THUNDERING HERD PROTECTION (Circuit Breaker)
// ==========================================
// If Redis dies, 10,000 requests will hit the DB concurrently, bringing down Postgres.
// We intercept DB fallback requests with a Circuit Breaker.
const dbQueryBreaker = new CircuitBreaker(
    async (userId) => {
        return await db.query(
            'SELECT id, name, email, user_type, role, phone, avatar, is_banned, token_version FROM users WHERE id = $1',
            [userId]
        );
    },
    {
        timeout: 3000, // 3 seconds timeout per DB query
        errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
        resetTimeout: 10000, // After 10 seconds, try a probe request
        volumeThreshold: 20 // Only trigger if we get 20 requests in 10 seconds
    }
);

dbQueryBreaker.on('open', () => logger.warn('🔥 DB CIRCUIT OPEN: Redis is down and DB is struggling! Rejecting auth requests to save Postgres.'));
dbQueryBreaker.on('halfOpen', () => logger.info('⚙️ DB CIRCUIT HALF-OPEN: Testing if Postgres has recovered...'));
dbQueryBreaker.on('close', () => logger.info('✅ DB CIRCUIT CLOSED: Postgres recovered, auth traffic flowing normally.'));
dbQueryBreaker.on('fallback', () => {
    logger.error('🛡️ DB FALLBACK ACTIVATED: Returning 503 Service Unavailable to shed load.');
    throw new Error('SERVICE_UNAVAILABLE'); // Caught by middleware and returns 503
});

/**
 * Get user from Redis cache or database.
 * Caches result in Redis to avoid per-request DB lookups (major performance win at scale).
 * @param {number} userId
 * @returns {Promise<object|null>} user object or null
 */
async function getUserWithCache(userId) {
    const cacheKey = `user_session:${userId}`;

    // 1. Try Redis cache first
    if (redisClient && redisClient.isOpen) {
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (cacheErr) {
            // Cache error is non-fatal - fall through to DB
        }
    }

    // 2. Cache miss — query the database WITH CIRCUIT BREAKER
    let result;
    try {
        result = await dbQueryBreaker.fire(userId);
    } catch (cbErr) {
        if (cbErr.message === 'SERVICE_UNAVAILABLE' || cbErr.code === 'EOPENBREAKER') {
            throw cbErr; // Allow route middleware to catch and return 503
        }
        return null;
    }

    if (result.rows.length === 0) return null;

    const user = result.rows[0];

    // 3. Store in cache (non-fatal if Redis is down)
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.setEx(cacheKey, USER_CACHE_TTL, JSON.stringify(user));
        } catch (cacheErr) {
            // Non-fatal - continue without caching
        }
    }

    return user;
}

/**
 * Invalidate a user's auth cache (call this when user is banned/updated).
 * @param {number} userId
 */
async function invalidateUserCache(userId) {
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.del(`user_session:${userId}`);
        } catch (err) { /* non-fatal */ }
    }
}

/**
 * Middleware to verify JWT token and attach user to request.
 * Uses Redis caching to avoid per-request DB queries under load.
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = verifyJWT(token, 'access');

        // SECURITY PATCH: Prevents using Refresh Tokens as Access Tokens
        if (decoded.type === 'refresh') {
            return res.status(401).json({ error: 'Refresh token cannot be used to access API endpoints' });
        }

        // Fetch user (from cache or DB)
        const user = await getUserWithCache(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'المستخدم غير موجود أو تم حذفه' });
        }

        // Security: Instantly kick out banned users
        // (cache TTL is 60s so ban propagates within 1 minute)
        if (user.is_banned) {
            await invalidateUserCache(decoded.id); // Clear cache so re-check is instant next time
            return res.status(403).json({ error: 'لقد تم حظر حسابك لمخالفة القوانين' });
        }

        // Check for Token Revocation (Enterprise Requirement)
        if (decoded.v !== undefined && decoded.v !== user.token_version) {
            return res.status(401).json({ error: 'انتهت صلاحية هذه الجلسة - يرجى تسجيل الدخول من جديد (Session Revoked)' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.message === 'SERVICE_UNAVAILABLE' || error.code === 'EOPENBREAKER') {
            return res.status(503).json({ error: 'الخدمة تواجه ضغطاً كبيراً، يرجى المحاولة بعد قليل (حماية النظام)' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى إعادة تسجيل الدخول' });
        }
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
    const type = req.user?.user_type;
    const partnerTypes = ['partner_owner', 'partner_supervisor', 'partner_courier', 'courier', 'admin'];

    if (!req.user || !partnerTypes.includes(type)) {
        return res.status(403).json({ error: 'غير مصرح - خاص بشركاء التوصيل' });
    }
    next();
};

/**
 * Enterprise Socket.io Authentication Middleware
 * Uses caching like HTTP middleware for consistent performance.
 */
const verifySocketToken = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
        if (!token) return next(new Error('Authentication error: Token missing'));

        const decoded = verifyJWT(token, 'access');

        // SECURITY PATCH: Prevents using Refresh Tokens as Access Tokens
        if (decoded.type === 'refresh') {
            return next(new Error('Authentication error: Refresh token not allowed'));
        }

        const user = await getUserWithCache(decoded.id);

        if (!user || user.is_banned) {
            return next(new Error('Authentication error: Invalid or banned user'));
        }

        // Check for Token Revocation
        if (decoded.v !== undefined && decoded.v !== user.token_version) {
            return next(new Error('Authentication error: Session revoked'));
        }

        socket.user = user;
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
    verifySocketToken,
    invalidateUserCache, // Export so ban/update routes can call it
};
