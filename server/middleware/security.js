const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const helmet = require('helmet');
const logger = require('../utils/logger');
const { client: redisClient } = require('../utils/redis');

let hasWarnedMemoryFallback = false;

// 1. DYNAMIC RATE LIMITERS
// ==========================================

// ==========================================
// 1. ELITE TIERED RATE LIMITERS (Sliding Window)
// ==========================================

// Helper to create a store that handles Redis reconnection/state automatically 
// ⚠️ WARNING: MemoryStore is NOT scalable and dangerous in multi-instance (PM2/K8s)
// It is used here ONLY as a temporary emergency fallback during Redis outages.
const createStore = () => {
    // If Redis is already connected, use it
    if (redisClient.status === 'ready') {
        return new RedisStore({
            sendCommand: async (...args) => {
                const [command, ...rest] = args;
                if (Array.isArray(command)) {
                    return redisClient.call(command[0], ...command.slice(1));
                }
                return redisClient.call(command, ...rest);
            }
        });
    }

    // Degraded Mode: Fallback to local memory
    if (!hasWarnedMemoryFallback) {
        hasWarnedMemoryFallback = true;
        logger.error('🚨 [RateLimiter] SYSTEM DEGRADED: Redis unavailable. Falling back to MemoryStore.');
        logger.error('🚨 [RateLimiter] WARNING: Rate limits are now per-instance and NOT synchronized across the cluster.');
    }
    
    return undefined; // Falls back to express-rate-limit internal MemoryStore
};

// Normalize IP keys safely for IPv6 and proxy scenarios.
const getIpKey = (req) => req.ip || req.socket?.remoteAddress || '127.0.0.1';

// A. Low-Trust / Public Rate Limiter (IP Based)
// Prevents high-velocity scanning/probing
const publicLimiter = rateLimit({
    store: createStore(),
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 1500, // Increased for NAT/Corporate networks
    message: { error: '⚠️ نشاط غير طبيعي من عنوانك. يرجى المحاولة لاحقاً.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// B. Strict Auth Limiter (Prevents Brute Force)
const authLimiter = rateLimit({
    store: createStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per IP
    keyGenerator: (req) => `rl_auth_${getIpKey(req)}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: '❌ تم حظر هاتفك لكثرة محاولات الدخول الفاشلة. انتظر 15 دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// C. Checkout & Payment Limiter (User + IP Based)
// Prevents high-concurrency race condition attempts & carding bots
const checkoutLimiter = rateLimit({
    store: createStore(),
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Allow 5 retries per minute to accommodate payment failures
    keyGenerator: (req) => `rl_checkout_${req.user?.id || getIpKey(req)}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: '🔔 أنت تقوم بإنشاء طلبات بسرعة كبيرة. يرجى الانتظار دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// D. Chat/Message Limiter (User Based)
const chatLimiter = rateLimit({
    store: createStore(),
    windowMs: 60 * 1000,
    max: 15,
    keyGenerator: (req) => `rl_chat_${req.user?.id || getIpKey(req)}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: '💬 أنت ترسل رسائل بسرعة كبيرة جداً.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET',
});

// E. Order/Booking Limiter
const orderLimiter = rateLimit({
    store: createStore(),
    windowMs: 1 * 60 * 1000,
    max: 5, // Allow slightly more for order creation
    keyGenerator: (req) => `rl_order_${req.user?.id || getIpKey(req)}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: '⚠️ أنت تقوم بإنشاء طلبات بسرعة كبيرة. يرجى الانتظار دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// F. Guest Login Limiter (Very Strict — prevents DB flooding with fake guest accounts)
const guestLoginLimiter = rateLimit({
    store: createStore(),
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 3, // Max 3 guest accounts per IP per hour
    keyGenerator: (req) => `rl_guest_${getIpKey(req)}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: 'تم الوصول إلى الحد الأقصى لتسجيل الدخول كزائر. يرجى المحاولة لاحقاً أو إنشاء حساب حقيقي.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==========================================
// 2. HELMET CSP CONFIGURATION (Enterprise strict)
// ==========================================
// Dynamic CSP based on environment
const connectSrcDirective = process.env.NODE_ENV === 'production'
    ? [
        "'self'",
        'https://qareeblak.com',
        'https://www.qareeblak.com',
        'https://api.qareeblak.com',
        'https://wa.qareeblak.com',
        'wss://qareeblak.com',
        'wss://www.qareeblak.com',
        'wss://api.qareeblak.com'
    ]
    : ["'self'", "ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*", "http://127.0.0.1:*"];

// Allow additional domains from env var (e.g. ALLOWED_ORIGINS="https://api.example.com,wss://api.example.com")
if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(origin => connectSrcDirective.push(origin.trim()));
}

const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://unpkg.com", "https://res.cloudinary.com"],
            connectSrc: connectSrcDirective,
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
});

// ==========================================
// 3. XSS SANITIZER (uses custom middleware/xss.js)
// ==========================================
const xssSanitizer = require('./xss');

const csrfProtection = (req, res, next) => {
    // 1. Skip safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    // 2. Double-Submit Cookie Check
    // The client must send the token in both a cookie (csrfToken) and a custom header (x-csrf-token)
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies?.csrfToken;

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        logger.warn(`🚨 [CSRF Protection] Blocked ${req.method} request to ${req.originalUrl} from ${req.ip}. Header: ${!!csrfHeader}, Cookie: ${!!csrfCookie}`);
        return res.status(403).json({ 
            error: 'حماية النظام: طلب غير مصرح به (CSRF). يرجى تحديث الصفحة والمحاولة مرة أخرى.' 
        });
    }
    next();
};

module.exports = {
    globalLimiter: publicLimiter,
    publicLimiter,
    authLimiter,
    chatLimiter,
    checkoutLimiter,
    orderLimiter,
    guestLoginLimiter,
    securityHeaders,
    xssSanitizer,
    csrfProtection
};
