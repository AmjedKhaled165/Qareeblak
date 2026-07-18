const cors = require('cors');
const compression = require('compression');
const path = require('path');
const crypto = require('crypto');
const pinoHttp = require('pino-http');
const cookieParser = require('cookie-parser');
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
    const localOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'];
    const allowLocalhostInProd = process.env.ALLOW_LOCALHOST_CORS !== 'false';
    const allowedOrigins = new Set([
        ...(process.env.NODE_ENV === 'production' ? productionOrigins : []),
        ...(allowLocalhostInProd ? localOrigins : (process.env.NODE_ENV === 'production' ? [] : localOrigins))
    ]);

    const corsOptions = {
        origin: (origin, callback) => {
            // Allow non-browser clients and same-origin server calls.
            if (!origin) return callback(null, true);
            if (allowedOrigins.has(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token'],
        optionsSuccessStatus: 204
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // [ELITE OBSERVABILITY] Request Logger using Pino-Http
    // Initialized early to trace the entire lifecycle
    app.use(pinoHttp({
        logger,
        genReqId: (req) => {
            const incoming = req.headers['x-request-id'];
            const id = (incoming && typeof incoming === 'string' && incoming.length < 64)
                ? incoming
                : crypto.randomUUID();
            req.id = id;
            return id;
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
        customProps: (req) => ({ requestId: req.id }),
        autoLogging: {
            ignore: (req) => req.url.includes('/api/health')
        }
    }));

    app.use((req, res, next) => {
        if (req.id) res.setHeader('X-Request-ID', req.id);
        next();
    });

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
    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Data Sanitization against XSS
    app.use(xssSanitizer);

    // ⏱️ Request Timeout Middleware — kills zombie requests after 25s
    // Prevents hanging connections from exhausting the server
    const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 25000);
    app.use((req, res, next) => {
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                logger.warn(`⏱️ Request timeout: ${req.method} ${req.url} exceeded ${REQUEST_TIMEOUT_MS}ms`);
                res.status(408).json({
                    success: false,
                    error: 'Request timeout — الطلب استغرق وقتاً طويلاً. يرجى المحاولة مرة أخرى.'
                });
            }
        }, REQUEST_TIMEOUT_MS);
        // Use .unref() so the timer doesn't prevent graceful shutdown
        timer.unref();
        // Clear timer when response finishes naturally
        res.on('finish', () => clearTimeout(timer));
        res.on('close', () => clearTimeout(timer));
        next();
    });

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
};
