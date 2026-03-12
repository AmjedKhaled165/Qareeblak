// 🛰️ [Big Tech Step] Initialize Tracing FIRST (Before any other imports)
require('./tracing');

const db = require('./db');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const logger = require('./utils/logger');

const configureMiddleware = require('./middleware/config');
const registerSocketHandlers = require('./socket/handlers');
const runStartupMigrations = require('./migrations/startup');
const runFinanceMigrations = require('./migrations/finance_and_fraud');
const { verifySocketToken } = require('./middleware/auth');
const globalErrorHandler = require('./middleware/errorHandler');

// ================== UTILS & SERVICES ==================
const healthRoutes = require('./routes/health');
const { initializeWorkers } = require('./utils/queues');
const { connectRedis } = require('./utils/redis');
const { initializeFirebase } = require('./utils/firebase');
const watchdog = require('./utils/watchdog');

// 🛡️ Activate System Guardian
watchdog.start();

// Initialize Firebase SDK early
initializeFirebase();

// Initialize Redis first; only start background workers if Redis is available
connectRedis().then(async (redisAvailable) => {
    if (redisAvailable) {
        try {
            await initializeWorkers();
        } catch (err) {
            logger.error('💥 Failed to initialize BullMQ workers:', err);
        }
    } else {
        logger.warn('Background job workers disabled (Redis unavailable).');
    }
}).catch(err => {
    logger.error('💥 Critical error during Redis/Worker initialization:', err);
});

const app = express();
// Trust first proxy (Coolify / reverse proxy) for correct IP/protocol handling
app.set('trust proxy', 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Sentry Integration (v10 API)
let Sentry = null;
if (process.env.SENTRY_DSN) {
    try {
        Sentry = require('@sentry/node');
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: 0.2,
        });
    } catch (err) {
        logger.warn('Sentry failed to initialize:', err.message);
        Sentry = null;
    }
}

// Socket.io setup for real-time tracking
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : ['https://qareeblak.com', 'https://www.qareeblak.com'])
            : true,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
});

// Redis Adapter for Socket.io (Scaling to multi-node)
// Set up AFTER Redis connects to avoid duplicate client error-spam
const { client: redisPublishClient } = require('./utils/redis');
redisPublishClient.on('ready', () => {
    try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const subClient = redisPublishClient.duplicate();
        io.adapter(createAdapter(redisPublishClient, subClient));
        logger.info('🚀 Socket.io Redis Adapter enabled');
    } catch (err) {
        logger.warn(`⚠️ Redis Adapter failed to initialize, falling back to local adapter: ${err.message}`);
    }
});

// Make io accessible to routes
app.set('io', io);

// Configure Middleware (CORS, CSP, Compression, Body Parsing, Static, Logger)
configureMiddleware(app, express);

// Run Startup Migrations (only if enabled)
// Ensure the value is literally the string 'true' before running
if (process.env.RUN_MIGRATIONS === 'true') {
    console.log('🚀 Running database migrations...');
    runStartupMigrations().then(() => {
        return runFinanceMigrations();
    }).catch(err => {
        console.error('💥 Migration Rejection:', err);
    });
} else {
    console.log('⏭️ Skipping migrations as per environment configuration.');
}

// Apply Enterprise WebSocket Auth 
io.use(verifySocketToken);

// Register Socket.io Handlers
registerSocketHandlers(io);

// ================== ROUTE IMPORTS ==================
const authRoutes = require('./routes/auth');
const providersRoutes = require('./routes/providers');
const servicesRoutes = require('./routes/services');
const bookingsRoutes = require('./routes/bookings');
const halanAuthRoutes = require('./routes/halan-auth');
const halanUsersRoutes = require('./routes/halan-users');
const halanOrdersRoutes = require('./routes/halan-orders');
const whatsappRoutes = require('./routes/whatsapp');
const halanProductRoutes = require('./routes/halan-products');
const chatRoutes = require('./routes/chat');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const wheelRoutes = require('./routes/wheel');

// ================== API ROUTES ==================
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/halan/auth', halanAuthRoutes);
app.use('/api/halan/users', halanUsersRoutes);
app.use('/api/halan/orders', halanOrdersRoutes);
app.use('/api/halan/products', halanProductRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wheel', wheelRoutes);

// 📊 Prometheus Metrics Scraper Endpoint (Protected — localhost scraper only)
const { register } = require('./utils/metrics');
const METRICS_TOKEN = process.env.METRICS_SCRAPE_TOKEN;
app.get('/metrics', async (req, res) => {
    // Security: Only allow localhost or a secret token (prevents public metric exposure)
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    const hasToken = METRICS_TOKEN && req.headers['x-metrics-token'] === METRICS_TOKEN;

    if (!isLocalhost && !hasToken) {
        // Return 404 to avoid revealing metrics endpoint existence to scanners
        return res.status(404).end();
    }

    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        logger.error('Metrics scrape failed', ex);
        res.status(500).end();
    }
});

// NOTE: /api/debug/users route has been REMOVED for production security.
// Use the /api/admin routes for user management instead.

// Error handling
if (Sentry) { Sentry.setupExpressErrorHandler(app); }
app.use(globalErrorHandler);

// ================== ELITE PRODUCTION HARDENING ==================
// 1. Force Request Timeouts (Prevent Slowloris and connection leaks)
const SERVER_TIMEOUT = 30000; // 30 seconds
server.timeout = SERVER_TIMEOUT;
server.headersTimeout = SERVER_TIMEOUT;
server.keepAliveTimeout = 65000; // Slightly higher than load balancer (Nginx)

// 2. Start Server
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ [Ready] Qareeblak Elite Backend listening on port ${PORT}`);
});

// 3. Graceful Shutdown (Elite Protocol)
const shutDown = async (signal) => {
    logger.info(`🛑 Received ${signal}. Orchestrating graceful exit...`);

    // Set a maximum time for graceful shutdown (10s)
    const forceExitTimeout = setTimeout(() => {
        logger.error('🔥 Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000);

    server.close(async () => {
        logger.info('🛰️ HTTP server closed.');
        try {
            await db.end();
            logger.info('🐘 Database pool drained.');

            const { client: redisClient } = require('./utils/redis');
            if (redisClient.status === 'ready') {
                await redisClient.quit();
                logger.info('🎈 Redis connection terminated.');
            }

            clearTimeout(forceExitTimeout);
            process.exit(0);
        } catch (err) {
            logger.error('💥 Shutdown error:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => shutDown('SIGTERM'));
process.on('SIGINT', () => shutDown('SIGINT'));
process.on('SIGUSR2', () => shutDown('SIGUSR2')); // For nodemon

process.on('uncaughtException', (err) => {
    console.error('💥 FATAL: Uncaught Exception:', err);
    if (err && err.stack) console.error('Stack:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 FATAL: Unhandled Rejection at promise:', promise);
    console.error('Reason:', reason);
    if (reason && reason.stack) console.error('Stack:', reason.stack);
    process.exit(1);
});
