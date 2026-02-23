/**
 * Qareeblak + Halan Unified API Server
 * PRODUCTION GRADE - ARCHITECTED FOR SCALABILITY
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const path = require('path');

// Internal Modules
const db = require('./db');
const logger = require('./utils/logger');
const { client: redisClient, connectRedis } = require('./utils/redis');
const { securityHeaders, globalLimiter, authLimiter } = require('./middleware/security');
const { verifyToken, isAdmin } = require('./middleware/auth');
const auditLogger = require('./middleware/audit');
const xssSanitizer = require('./middleware/xss');

// Validate Environment
if (!process.env.JWT_SECRET && (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging')) {
    logger.error('CRITICAL: JWT_SECRET is missing. Server shutting down.');
    process.exit(1);
}

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

// ================= Global Middleware =================
app.use(securityHeaders); // Security (Helmet)
app.use(xssSanitizer);    // Anti-XSS Protection
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.use(express.json({ limit: '5mb' })); // Limit payload size to 5MB
app.use(globalLimiter);   // Rate Limiting

// Audit Log & Performance Tracking
app.use(auditLogger);
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            logger.warn(`🐌 Slow Request: ${req.method} ${req.url} took ${duration}ms`);
        }
    });
    next();
});

// ================= Database & Redis Init =================
async function initializeServices() {
    try {
        await connectRedis();

        // Setup Socket.io with Redis Adapter for scale
        const io = new Server(server, {
            cors: {
                origin: true, // Should be restricted in extreme prod
                methods: ['GET', 'POST'],
                credentials: true,
            },
            adapter: createAdapter(redisClient, redisClient.duplicate()),
            pingTimeout: 30000,
            pingInterval: 10000,
        });

        app.set('io', io);
        setupSocketHandlers(io);

        logger.info('🚀 Backend services initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize services:', error);
    }
}

// ================= Routes =================
const authRoutes = require('./routes/auth');
const providersRoutes = require('./routes/providers');
const servicesRoutes = require('./routes/services');
const bookingsRoutes = require('./routes/bookings');
const halanAuthRoutes = require('./routes/halan-auth');
const halanUsersRoutes = require('./routes/halan-users');
const halanOrdersRoutes = require('./routes/halan-orders');
const halanProductRoutes = require('./routes/halan-products');
const whatsappRoutes = require('./routes/whatsapp');
const chatRoutes = require('./routes/chat');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Apply authLimiter to sensitive endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

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

// Health check with DB status
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
        res.json({
            status: 'ok',
            database: 'connected',
            redis: redisStatus,
            uptime: process.uptime(),
            timestamp: new Date()
        });
    } catch (e) {
        res.status(503).json({ status: 'error', database: 'error', message: e.message });
    }
});

// ================= Socket.io Logic (Redis Backed) =================
function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        logger.info(`🔌 Client connected: ${socket.id}`);

        // Chat Handlers
        socket.on('join-consultation', (consultationId) => {
            socket.join(`chat-${consultationId}`);
            logger.info(`💬 Joined chat: chat-${consultationId}`);
        });

        socket.on('send_message', async (data) => {
            try {
                const { consultationId, message, imageUrl, senderId, senderType, senderName } = data;
                if (!consultationId || (!message && !imageUrl)) return;

                const result = await db.query(`
                    INSERT INTO chat_messages (consultation_id, sender_id, sender_type, message, image_url)
                    VALUES ($1, $2, $3, $4, $5) RETURNING *
                `, [consultationId, senderId, senderType || 'customer', message || null, imageUrl || null]);

                await db.query('UPDATE consultations SET updated_at = NOW() WHERE id = $1', [consultationId]);

                const savedMessage = { ...result.rows[0], sender_name: senderName || 'مستخدم' };
                io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
            } catch (error) {
                logger.error('Chat error:', error);
                socket.emit('message_error', { error: 'حدث خطأ في إرسال الرسالة' });
            }
        });

        // Driver Tracking Logic (Redis Backed)
        socket.on('sendLocation', async (data) => {
            const { courierId, latitude, longitude, orderId } = data;
            if (!courierId) return;

            const driverId = String(courierId);
            const locationData = JSON.stringify({
                ...data,
                timestamp: new Date().toISOString()
            });

            // Set in Redis with 24hr expiration
            await redisClient.setEx(`driver_loc:${driverId}`, 86400, locationData);
            await redisClient.setEx(`driver_status:${driverId}`, 86400, 'online');

            // Broadcast
            const locUpdate = { ...data, driverId };
            if (orderId) io.to(`order-${orderId}`).emit('updateLocation', locUpdate);
            io.to(`driver-${driverId}`).emit('updateLocation', locUpdate);
            io.to('managers').emit('updateLocation', locUpdate);

            // Async persist to DB (non-blocking)
            db.query('UPDATE users SET latitude = $1, longitude = $2, last_location_update = NOW() WHERE id = $3',
                [latitude, longitude, courierId]
            ).catch(err => logger.error('DB Location Sync Error:', err));
        });

        socket.on('disconnect', () => {
            logger.info(`🔌 Client disconnected: ${socket.id}`);
        });
    });
}

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Unhandled Exception:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// Bootstrap
initializeServices().then(() => {
    server.listen(PORT, () => {
        logger.info(`🔥 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
});

// ================= Graceful Shutdown =================
const gracefulShutdown = async (signal) => {
    logger.info(`🛑 ${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        logger.info('🛰️ HTTP server closed.');

        // Close DB connections
        db.pool.end(() => {
            logger.info('📊 PostgreSQL pool has ended.');

            // Close Redis
            redisClient.quit().then(() => {
                logger.info('💾 Redis connection closed.');
                process.exit(0);
            });
        });
    });

    // Force shutdown if it takes too long
    setTimeout(() => {
        logger.error('⚠️ Could not close connections in time, forcing shut down');
        process.exit(1);
    }, 15000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // process.exit(1); // Usually best to restart in prod
});
