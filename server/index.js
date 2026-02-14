const db = require('./db');
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const path = require('path');


const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup for real-time tracking
const io = new Server(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
    // Explicitly whitelist frontend origins (browsers treat 127.0.0.1 and localhost as different)
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

// ⚠️ DISABLE CSP headers entirely (temporary debugging fix)
app.use((req, res, next) => {
    // Remove any CSP headers that might be added by other middleware
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Security-Policy');
    res.removeHeader('X-WebKit-CSP');
    next();
});

// Compression middleware - reduces response size by 60-90%
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    },
    level: 6, // Balance between speed and compression ratio
    threshold: 1024, // Only compress responses > 1KB
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request Logger
app.use((req, res, next) => {
    console.log(`➡️  ${req.method} ${req.url}`);
    next();
});

// Import Qareeblak routes
const authRoutes = require('./routes/auth');
const providersRoutes = require('./routes/providers');

// Migration: Ensure default ratings are 0.0 for providers with no reviews
db.query("UPDATE providers SET rating = 0.0 WHERE reviews_count = 0")
    .then(res => {
        if (res.rowCount > 0) console.log(`✅ Rating Migration: Updated ${res.rowCount} providers to 0.0 rating`);
    })
    .catch(err => console.error('❌ Rating Migration Error:', err.message));

// Migration: Safe column and index checks to avoid permission errors if already present
async function runMigrations() {
    try {
        // 1. Check for appointment columns
        const colCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'appointment_date'
        `);

        if (colCheck.rows.length === 0) {
            console.log('🔄 Attempting to add appointment columns...');
            await db.query(`
                ALTER TABLE bookings 
                ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)
            `);
            console.log(`✅ Bookings Migration: Added appointment columns`);
        }

        // 2. Check for appointment index
        const indexCheck = await db.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'bookings' AND indexname = 'idx_bookings_appointment_date'
        `);

        if (indexCheck.rows.length === 0) {
            console.log('🔄 Attempting to create appointment index...');
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date 
                ON bookings(appointment_date)
            `);
            console.log(`✅ Index Migration: Created appointment_date index`);
        }
    } catch (err) {
        // Log error but don't crash - if columns already exist, we're likely fine
        if (err.message.includes('permission denied') || err.message.includes('must be owner')) {
            console.warn('⚠️ Migration Warning: Insufficient permissions to modify schema. If columns already exist, this can be ignored.');
        } else {
            console.error('❌ Migration Error:', err.message);
        }
    }
}

runMigrations();

// Migration: Add order_type column to delivery_orders (safe, idempotent)
db.query("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'manual'")
    .then(() => {
        // Backfill existing app orders
        return db.query("UPDATE delivery_orders SET order_type = 'app' WHERE source ILIKE '%qareeblak%' AND (order_type IS NULL OR order_type = 'manual')");
    })
    .then(res => {
        if (res.rowCount > 0) console.log(`✅ Order Type Migration: Backfilled ${res.rowCount} app orders`);
    })
    .catch(err => {
        if (!err.message.includes('already exists')) {
            console.error('❌ Order Type Migration Error:', err.message);
        }
    });

// Migration: Add is_online and max_active_orders columns for courier capacity
db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false")
    .catch(err => { if (!err.message.includes('already exists')) console.error('is_online migration:', err.message); });
db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS max_active_orders INTEGER DEFAULT 10")
    .catch(err => { if (!err.message.includes('already exists')) console.error('max_active_orders migration:', err.message); });

const servicesRoutes = require('./routes/services');
const bookingsRoutes = require('./routes/bookings');

// Import Halan routes
const halanAuthRoutes = require('./routes/halan-auth');
const halanUsersRoutes = require('./routes/halan-users');
const halanOrdersRoutes = require('./routes/halan-orders');
const whatsappRoutes = require('./routes/whatsapp');
const halanProductRoutes = require('./routes/halan-products');
const chatRoutes = require('./routes/chat');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// ================== API ROUTES ==================

// Qareeblak API routes
app.use('/api/auth', authRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);

// Halan API routes
app.use('/api/halan/auth', halanAuthRoutes);
app.use('/api/halan/users', halanUsersRoutes);
app.use('/api/halan/orders', halanOrdersRoutes);
app.use('/api/halan/products', halanProductRoutes);

// WhatsApp API routes
app.use('/api/whatsapp', whatsappRoutes);

// Chat API routes (Pharmacy consultations)
app.use('/api/chat', chatRoutes);

// Notifications API routes
app.use('/api/notifications', notificationsRoutes);

// Admin API routes
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Qareeblak + Halan API is running',
        services: ['qareeblak', 'halan']
    });
});

// ================= SOCKET.IO HANDLERS =================
// In-memory state for driver locations
const driverLocations = new Map();
const driverStatuses = new Map();
const driverSockets = new Map();

// Only clear locations older than 24 hours (not on every startup)
const clearStaleLocations = async () => {
    try {
        console.log('🧹 Clearing driver locations older than 24 hours...');
        const result = await db.query(`
            UPDATE users 
            SET latitude = NULL, longitude = NULL, is_available = false 
            WHERE user_type = 'partner_courier' 
            AND last_location_update < NOW() - INTERVAL '24 hours'
        `);
        console.log(`✅ Cleared ${result.rowCount} stale driver locations`);
    } catch (error) {
        console.error('❌ Failed to clear stale driver locations:', error.message);
    }
};

// Clear stale locations on startup
clearStaleLocations();

// Run cleanup every hour
setInterval(clearStaleLocations, 60 * 60 * 1000);

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // ========== CHAT HANDLERS ==========
    // Join a consultation chat room
    socket.on('join-consultation', (consultationId) => {
        // ID now already includes 'chat_' prefix (e.g., chat_123_456)
        socket.join(consultationId);
        console.log(`💬 Client joined chat: ${consultationId}`);
    });

    // Leave a consultation chat room
    socket.on('leave-consultation', (consultationId) => {
        socket.leave(consultationId);
        console.log(`💬 Client left chat: ${consultationId}`);
    });

    // Send message via Socket.io
    socket.on('send_message', async (data) => {
        try {
            const { consultationId, message, imageUrl, senderId, senderType, senderName } = data;
            console.log('[Chat] Received send_message event:', { consultationId, senderId, senderType });

            if (!consultationId) {
                console.error('[Chat] Missing consultationId in send_message');
                socket.emit('message_error', { error: 'معرف المحادثة مفقود' });
                return;
            }

            if (!message && !imageUrl) {
                console.error('[Chat] No message or image in send_message');
                socket.emit('message_error', { error: 'الرسالة أو الصورة مطلوبة' });
                return;
            }

            // Store message in database
            const result = await db.query(`
                INSERT INTO chat_messages (consultation_id, sender_id, sender_type, message, image_url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [consultationId, senderId, senderType || 'customer', message || null, imageUrl || null]);

            // Update consultation updated_at
            await db.query(
                'UPDATE consultations SET updated_at = NOW() WHERE id = $1',
                [consultationId]
            );

            const savedMessage = {
                ...result.rows[0],
                sender_name: senderName || 'مستخدم'
            };

            console.log('[Chat] Message saved:', savedMessage.id);

            // Broadcast to all users in the consultation room
            io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
            console.log('[Chat] Message broadcast to room: chat-' + consultationId);

            // Send confirmation to sender
            socket.emit('message_sent', { success: true, messageId: savedMessage.id });
        } catch (error) {
            console.error('[Chat] Error in send_message:', error.message);
            socket.emit('message_error', { error: 'حدث خطأ في إرسال الرسالة' });
        }
    });

    // Typing indicator
    socket.on('typing', ({ consultationId, userId, userName }) => {
        console.log('[Chat] User typing:', { consultationId, userId, userName });
        socket.to(`chat-${consultationId}`).emit('user-typing', { userId, userName });
    });

    // Stop typing indicator
    socket.on('stop-typing', ({ consultationId, userId }) => {
        console.log('[Chat] User stop typing:', { consultationId, userId });
        socket.to(`chat-${consultationId}`).emit('user-stop-typing', { userId });
    });

    // Pharmacist online status
    socket.on('pharmacist-online', (providerId) => {
        socket.providerId = providerId;
        socket.join(`provider-${providerId}`);
        io.emit('pharmacist-status', { providerId, status: 'online' });
        console.log(`💊 Pharmacist ${providerId} is now online`);
    });

    socket.on('pharmacist-offline', (providerId) => {
        io.emit('pharmacist-status', { providerId, status: 'offline' });
        console.log(`💊 Pharmacist ${providerId} is now offline`);
    });

    // ========== DRIVER LOCATION HANDLERS ==========

    // Driver sends location update
    socket.on('sendLocation', async (data) => {
        // Normalize coordinates (handle both lat/lng and latitude/longitude)
        const latitude = data.latitude || data.lat;
        const longitude = data.longitude || data.lng;
        const { orderId, courierId, heading, speed, accuracy } = data;

        if (courierId) {
            const sid = String(courierId);
            socket.driverId = courierId; // Store for disconnect handler

            // Track this socket if not already tracked
            if (!driverSockets.has(sid)) {
                driverSockets.set(sid, new Set());
            }
            driverSockets.get(sid).add(socket.id);

            const timestamp = new Date().toISOString();

            // 1. Update In-Memory Map
            const existingLoc = driverLocations.get(sid);
            const driverName = data.name || (existingLoc ? existingLoc.name : null);

            driverLocations.set(sid, {
                latitude,
                longitude,
                heading: heading || 0,
                speed: speed || 0,
                accuracy: accuracy || 0,
                timestamp,
                name: driverName
            });

            if (driverStatuses.get(sid) !== 'online') {
                driverStatuses.set(sid, 'online');
                io.emit('driver-status-changed', { driverId: courierId, status: 'online' });
            }

            // Broadcast function to hit all relevant targets
            const broadcastLocation = (nameOverride) => {
                const locUpdate = {
                    driverId: courierId,
                    name: nameOverride || driverName,
                    latitude, longitude, heading: heading || 0, speed: speed || 0,
                    accuracy: accuracy || 0, timestamp
                };

                // Broadcast to order room
                if (orderId) io.to(`order-${orderId}`).emit('updateLocation', locUpdate);

                // Broadcast to driver-specific room
                io.to(`driver-${courierId}`).emit('updateLocation', locUpdate);

                // Broadcast to global managers room
                io.to('managers').emit('updateLocation', locUpdate);
            };

            // If name is missing, try to fetch it from DB once
            if (!driverName) {
                db.query('SELECT name FROM users WHERE id = $1', [courierId])
                    .then(res => {
                        if (res.rows.length > 0 && res.rows[0].name) {
                            const name = res.rows[0].name;
                            const current = driverLocations.get(sid);
                            if (current) {
                                driverLocations.set(sid, { ...current, name });
                                // RE-BROADCAST with the correct name
                                broadcastLocation(name);
                            }
                        }
                    })
                    .catch(err => console.error('Error fetching name for driver:', err.message));
            }

            // Initial broadcast
            broadcastLocation();

            // 2. Persist to DB
            db.query(
                'UPDATE users SET latitude = $1, longitude = $2, last_location_update = NOW() WHERE id = $3',
                [latitude, longitude, courierId]
            ).catch(err => console.error('Error persisting location:', err.message));

            console.log(`📍 Location from driver: ${courierId} (${driverName || 'NO NAME'}) at (${latitude}, ${longitude})`);
        }
    });

    // Driver becomes online
    socket.on('driver-online', (driverId) => {
        if (!driverId) return;
        const sid = String(driverId);
        socket.driverId = driverId;
        driverStatuses.set(driverId, 'online');
        console.log(`🚗 Driver ${driverId} is now online`);
        io.emit('driver-status-changed', { driverId, status: 'online' });

        if (driverLocations.has(driverId)) {
            io.to(`driver-${driverId}`).emit('updateLocation', driverLocations.get(driverId));
        }
    });

    // Manager joins to track a driver
    socket.on('join-driver-tracking', (driverId) => {
        socket.join(`driver-${driverId}`);
        console.log(`👀 Manager joined tracking for driver: ${driverId}`);

        if (driverStatuses.has(driverId)) {
            socket.emit('driver-status-changed', { driverId, status: driverStatuses.get(driverId) });
        }
        if (driverLocations.has(driverId)) {
            socket.emit('updateLocation', driverLocations.get(driverId));
        }
    });

    // Manager joins to track ALL drivers (Fleet Map)
    socket.on('join-managers', () => {
        socket.join('managers');
        console.log(`👀 Manager joined global fleet tracking`);

        // Send all current locations to the new manager
        driverLocations.forEach((location, driverId) => {
            socket.emit('updateLocation', { ...location, driverId });
        });
    });

    // Customer joins order tracking
    socket.on('join-tracking', (orderId) => {
        socket.join(`order-${orderId}`);
        console.log(`👀 Client joined order tracking: order-${orderId}`);
    });

    // Driver explicitly logs out - clear their location
    socket.on('driver-logout', (driverId) => {
        if (driverId) {
            const sid = String(driverId);
            console.log(`🚪 Driver ${driverId} logged out, clearing location`);

            // Clear socket tracking
            if (driverSockets.has(sid)) {
                driverSockets.delete(sid);
            }

            // Remove from in-memory maps
            driverLocations.delete(sid);
            driverStatuses.set(sid, 'offline');

            // Clear from database
            db.query(
                'UPDATE users SET latitude = NULL, longitude = NULL, last_location_update = NULL WHERE id = $1',
                [driverId]
            ).catch(err => console.error('Error clearing location on logout:', err.message));

            // Notify all managers to remove this driver from map
            io.to('managers').emit('driver-offline', { driverId });
            io.emit('driver-status-changed', { driverId, status: 'offline' });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        if (socket.driverId) {
            const driverId = socket.driverId;
            const sid = String(driverId);

            // Remove this specific socket from tracking
            if (driverSockets.has(sid)) {
                const sockets = driverSockets.get(sid);
                sockets.delete(socket.id);

                // Only if NO MORE active sockets, mark as offline
                if (sockets.size === 0) {
                    driverSockets.delete(sid);

                    // DON'T delete location on disconnect - keep it in DB
                    // Location stays until logout or 24hr cleanup
                    // Only update in-memory status
                    driverStatuses.set(sid, 'offline');

                    // Notify managers (but location stays on map with "offline" style)
                    io.to('managers').emit('driver-status-changed', { driverId, status: 'offline' });
                    io.emit('driver-status-changed', { driverId, status: 'offline' });

                    console.log(`🔴 Driver ${driverId} is now offline (No more sockets) - location preserved`);
                } else {
                    console.log(`📡 Driver ${driverId} disconnected one socket but remains online (${sockets.size} left)`);
                }
            }
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// TEMP: List all users
app.get('/api/debug/users', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.phone, 
                u.email,
                u.role, 
                u.user_type, 
                u.is_available,
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

// Start server (use 'server' not 'app' for Socket.io)
console.log('📡 Attempting to start server on port', PORT);
server.listen(PORT, () => {
    console.log('✨ Server is now listening!');
    console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🚀 Qareeblak + Halan Unified API Server             ║
  ║                                                       ║
  ║   Port: ${String(PORT).padEnd(45)}║
  ║   Qareeblak: /api/auth, /api/providers, etc.          ║
  ║   Halan: /api/halan/auth, /api/halan/orders           ║
  ║   Socket.io: Real-time tracking enabled               ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
    `);
});

// Handle server errors (like port in use)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use.`);
        console.error(`💡 Try running: taskkill /F /IM node.exe (Warning: kills all node processes)`);
        process.exit(1);
    } else {
        console.error('❌ Server startup error:', err);
    }
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('\n🛑 Received shutdown signal. Closing server...');
    server.close(async () => {
        console.log('📡 HTTP server closed.');
        try {
            if (db.pool) {
                await db.pool.end();
                console.log('✅ Database pool closed.');
            }
            console.log('🗄️ Database pool closed.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error closing database pool:', err);
            process.exit(1);
        }
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    console.error(err.stack);
});

console.log('🏁 Script execution reached end of index.js');

