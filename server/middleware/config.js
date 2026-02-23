const cors = require('cors');
const compression = require('compression');
const path = require('path');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');
const { globalLimiter, securityHeaders, xssSanitizer } = require('./security');

/**
 * Configure all app middleware
 * @param {Express} app - Express application instance
 * @param {Object} express - Express module
 */
module.exports = function configureMiddleware(app, express) {
    // 🛡️ Strict Security Headers (CSP, HSTS, etc.)
    app.use(securityHeaders);

    // CORS configuration (Strict)
    app.use(cors({
        origin: process.env.NODE_ENV === 'production'
            ? ['https://qareeblak.com', 'https://www.qareeblak.com']
            : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression middleware
    app.use(compression({
        filter: (req, res) => {
            if (req.headers['x-no-compression']) return false;
            return compression.filter(req, res);
        },
        level: 6,
        threshold: 1024,
    }));

    // Body parsing (Strict limit against Memory Exhaustion/DoS)
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true, limit: '2mb' }));

    // Data Sanitization against XSS
    app.use(xssSanitizer);

    // ⛔ Global Rate Limiting to prevent DoS & Brute Force Attacks
    app.use('/api', globalLimiter);

    // Static files
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // Request Logger using Pino-Http (Ultra-fast, structured logging)
    app.use(pinoHttp({
        logger,
        // Don't spam logs with health check success
        autoLogging: {
            ignore: (req) => req.url.includes('/api/health')
        }
    }));
};
