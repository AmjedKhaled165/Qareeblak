const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Global rate limiter to prevent DDoS and brute force
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: 'تم تجاوز عدد المحاولات المسموح بها، يرجى المحاولة لاحقاً' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Stricter limiter for auth endpoints (login/register)
 */
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 login attempts per hour
    message: { error: 'محاولات دخول كثيرة جداً، يرجى المحاولة بعد ساعة' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Configure Helmet security headers
 */
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
});

module.exports = {
    globalLimiter,
    authLimiter,
    securityHeaders
};
