// Import DB pool
const db = require('./db');
const { Pool } = require('pg');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();


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
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
    console.log(`➡️  ${req.method} ${req.url}`);
    next();
});

// Import Qareeblak routes
const authRoutes = require('./routes/auth');
const providersRoutes = require('./routes/providers');
const servicesRoutes = require('./routes/services');
const bookingsRoutes = require('./routes/bookings');

// Import Halan routes
const halanAuthRoutes = require('./routes/halan-auth');
const halanUsersRoutes = require('./routes/halan-users');
const halanOrdersRoutes = require('./routes/halan-orders');
const whatsappRoutes = require('./routes/whatsapp');
const halanProductRoutes = require('./routes/halan-products');

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

// Start server (use 'server' not 'app' for Socket.io)
server.listen(PORT, () => {
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

