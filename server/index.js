const db = require('./db');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const logger = require('./utils/logger');

const configureMiddleware = require('./middleware/config');
const registerSocketHandlers = require('./socket/handlers');
const runStartupMigrations = require('./migrations/startup');
const { verifyToken, isAdmin, verifySocketToken } = require('./middleware/auth');
const globalErrorHandler = require('./middleware/errorHandler');

// ================== UTILS & SERVICES ==================
const healthRoutes = require('./routes/health');
const { initializeWorkers } = require('./utils/queues');
const { connectRedis } = require('./utils/redis');

// Initialize Redis first; only start background workers if Redis is available
connectRedis().then((redisAvailable) => {
    if (redisAvailable) {
        initializeWorkers();
    } else {
        logger.warn('Background job workers disabled (Redis unavailable).');
    }
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Sentry Integration Placeholder
if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
    app.use(Sentry.Handlers.requestHandler());
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
        logger.warn('⚠️ Redis Adapter failed to initialize, falling back to local adapter');
    }
});

// Make io accessible to routes
app.set('io', io);

// Configure Middleware (CORS, CSP, Compression, Body Parsing, Static, Logger)
configureMiddleware(app, express);

// Run Startup Migrations
runStartupMigrations();

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

// Secured User List (Admin Only)
app.get('/api/debug/users', verifyToken, isAdmin, async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, u.name, u.username, u.phone, u.email,
                u.role, u.user_type, u.is_available,
                to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as created_at,
                p.name as brand_name,
                p.category as provider_category,
                s.name as supervisor_name
            FROM users u
            LEFT JOIN providers p ON u.id = p.user_id
            LEFT JOIN courier_supervisors cs ON u.id = cs.courier_id
            LEFT JOIN users s ON cs.supervisor_id = s.id
            ORDER BY u.id ASC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Error handling
if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    app.use(Sentry.Handlers.errorHandler());
}
app.use(globalErrorHandler);

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Server is running on port ${PORT}`);
});

// ================== GRACEFUL SHUTDOWN ==================
const shutDown = async () => {
    logger.info('🛑 Received shutdown signal. Closing gracefully...');
    server.close(async () => {
        try {
            await db.end();
            const { client: redisClient } = require('./utils/redis');
            if (redisClient.isOpen) await redisClient.quit();
            process.exit(0);
        } catch (err) {
            logger.error('Error during shutdown:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
