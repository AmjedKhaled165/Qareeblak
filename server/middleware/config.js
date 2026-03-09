const cors = require('cors');
const compression = require('compression');
const path = require('path');
const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');
const { publicLimiter, securityHeaders, xssSanitizer } = require('./security');
const { httpRequestDurationMicroseconds, httpRequestsTotal } = require('../utils/metrics');

/**
 * Configure all app middleware
 * @param {Express} app - Express application instance
 * @param {Object} express - Express module
 */
module.exports = function configureMiddleware(app, express) {
    // 🛡️ Strict Security Headers (CSP, HSTS, etc.)
    app.use(securityHeaders);

    // CORS configuration (Strict) - Production origins from env or defaults
    const productionOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : ['https://qareeblak.com', 'https://www.qareeblak.com'];

    app.use(cors({
        origin: process.env.NODE_ENV === 'production'
            ? productionOrigins
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
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Data Sanitization against XSS
    app.use(xssSanitizer);

    // ⛔ Global Rate Limiting to prevent DoS & Brute Force Attacks
    app.use('/api', publicLimiter);

    // 📊 Prometheus Metrics Collection (Elite Observability)
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            // Best effort to get the abstract route path (e.g. /api/bookings/:id)
            const route = req.route ? req.route.path : (req.baseUrl + req.path).replace(/\/[0-9a-f-]{36}/g, '/:id');

            httpRequestsTotal.inc({ method: req.method, route, code: res.statusCode });
            httpRequestDurationMicroseconds.observe({ method: req.method, route, code: res.statusCode }, duration);
        });
        next();
    });

    // Static files
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // Request Logger using Pino-Http (Ultra-fast, structured logging)
    // genReqId: assigns a unique UUID to every request for cross-worker tracing
    app.use(pinoHttp({
        logger,
        genReqId: (req) => {
            // Honour upstream X-Request-ID (from load balancer / Nginx) or generate one
            const incoming = req.headers['x-request-id'];
            const id = (incoming && typeof incoming === 'string' && incoming.length < 64)
                ? incoming
                : crypto.randomUUID();
            req.id = id;
            return id;
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
        // Attaches request ID to every log line for distributed tracing
        customProps: (req) => ({ requestId: req.id }),
        // Don't log health-check noise
        autoLogging: {
            ignore: (req) => req.url.includes('/api/health')
        }
    }));

    // Propagate request ID back to client so frontend can include it in bug reports
    app.use((req, res, next) => {
        if (req.id) res.setHeader('X-Request-ID', req.id);
        next();
    });
};
