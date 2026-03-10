const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const xss = require('xss-clean');
const helmet = require('helmet');
const logger = require('../utils/logger');
const { client: redisClient } = require('../utils/redis');

// 1. DYNAMIC RATE LIMITERS
// ==========================================

// ==========================================
// 1. ELITE TIERED RATE LIMITERS (Sliding Window)
// ==========================================

// Helper to create a store only if Redis is available, otherwise fallback to memory
const createStore = () => {
    if (redisClient.isOpen) {
        return new RedisStore({
            sendCommand: (...args) => redisClient.sendCommand(args)
        });
    }
    logger.warn('⚠️ Redis not ready, using memory store for rate limiting');
    return undefined; // express-rate-limit will use memory store
};

// A. Low-Trust / Public Rate Limiter (IP Based)
// Prevents high-velocity scanning/probing
const publicLimiter = rateLimit({
    store: createStore(),
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 300,
    message: { error: '⚠️ نشاط غير طبيعي من عنوانك. يرجى المحاولة لاحقاً.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// B. Strict Auth Limiter (Prevents Brute Force)
const authLimiter = rateLimit({
    store: createStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP
    keyGenerator: (req) => `rl_auth_${req.ip}`,
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
    max: 2, // Max 2 checkouts per minute (Very strict)
    keyGenerator: (req) => `rl_checkout_${req.user?.id || req.ip}`,
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
    keyGenerator: (req) => `rl_chat_${req.user?.id || req.ip}`,
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
    keyGenerator: (req) => `rl_order_${req.user?.id || req.ip}`,
    validate: { keyGeneratorIpFallback: false },
    message: { error: '⚠️ أنت تقوم بإنشاء طلبات بسرعة كبيرة. يرجى الانتظار دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==========================================
// 2. HELMET CSP CONFIGURATION (Enterprise strict)
// ==========================================
// Dynamic CSP based on environment
const connectSrcDirective = process.env.NODE_ENV === 'production'
    ? ["'self'", "wss://qareeblak.com", "wss://www.qareeblak.com", "https://qareeblak.com", "https://www.qareeblak.com"]
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
// 3. XSS SANITIZER
// ==========================================
const xssSanitizer = xss();

module.exports = {
    globalLimiter: publicLimiter, // Alias for routes calling it global
    publicLimiter,
    authLimiter,
    chatLimiter,
    checkoutLimiter,
    orderLimiter,
    securityHeaders,
    xssSanitizer
};
