const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const helmet = require('helmet');

// ==========================================
// 1. DYNAMIC RATE LIMITERS
// ==========================================

// Global Limiter - General API Protection
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: { error: 'تم تجاوز الحد المسموح به من الطلبات. يرجى الانتظار قليلاً والمحاولة مرة أخرى.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict Auth Limiter - Prevent Brute Force & Credential Stuffing
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts only
    message: { error: '❌ تم حظر IP الخاص بك لكثرة المحاولات الخاطئة. انتظر 15 دقيقة.' },
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
    globalLimiter,
    authLimiter,
    securityHeaders,
    xssSanitizer
};
