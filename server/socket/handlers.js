const db = require('../db');

// In-memory state for driver locations
const driverLocations = new Map();
const driverStatuses = new Map();
const driverSockets = new Map();

/**
 * Register all Socket.io handlers
 * @param {Server} io - Socket.io Server instance
 */
module.exports = function registerSocketHandlers(io) {
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
                io.to(consultationId).emit('new-message', savedMessage);
                console.log('[Chat] Message broadcast to room: ' + consultationId);

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
            socket.to(consultationId).emit('user-typing', { userId, userName });
        });

        // Stop typing indicator
        socket.on('stop-typing', ({ consultationId, userId }) => {
            console.log('[Chat] User stop typing:', { consultationId, userId });
            socket.to(consultationId).emit('user-stop-typing', { userId });
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
            const latitude = data.latitude || data.lat;
            const longitude = data.longitude || data.lng;
            const { orderId, courierId, heading, speed, accuracy } = data;

            if (courierId) {
                const sid = String(courierId);
                socket.driverId = courierId;

                if (!driverSockets.has(sid)) {
                    driverSockets.set(sid, new Set());
                }
                driverSockets.get(sid).add(socket.id);

                const timestamp = new Date().toISOString();
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

                const broadcastLocation = (nameOverride) => {
                    const locUpdate = {
                        driverId: courierId,
                        name: nameOverride || driverName,
                        latitude, longitude, heading: heading || 0, speed: speed || 0,
                        accuracy: accuracy || 0, timestamp
                    };

                    if (orderId) io.to(`order-${orderId}`).emit('updateLocation', locUpdate);
                    io.to(`driver-${courierId}`).emit('updateLocation', locUpdate);
                    io.to('managers').emit('updateLocation', locUpdate);
                };

                if (!driverName) {
                    db.query('SELECT name FROM users WHERE id = $1', [courierId])
                        .then(res => {
                            if (res.rows.length > 0 && res.rows[0].name) {
                                const name = res.rows[0].name;
                                const current = driverLocations.get(sid);
                                if (current) {
                                    driverLocations.set(sid, { ...current, name });
                                    broadcastLocation(name);
                                }
                            }
                        })
                        .catch(err => console.error('Error fetching name for driver:', err.message));
                }

                broadcastLocation();

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

            driverLocations.forEach((location, driverId) => {
                socket.emit('updateLocation', { ...location, driverId });
            });
        });

        // Customer joins order tracking
        socket.on('join-tracking', (orderId) => {
            socket.join(`order-${orderId}`);
            console.log(`👀 Client joined order tracking: order-${orderId}`);
        });

        // ==========================================
        // TARGETED USER ROOMS (To prevent broadcast storms)
        // ==========================================
        socket.on('user-join', ({ userId, userType }) => {
            if (userId) {
                socket.join(`user-${userId}`);
                console.log(`👤 Client joined user room: user-${userId} (${userType || 'unknown'})`);
            }
        });

        // Driver explicitly logs out
        socket.on('driver-logout', (driverId) => {
            if (driverId) {
                const sid = String(driverId);
                console.log(`🚪 Driver ${driverId} logged out, clearing location`);

                if (driverSockets.has(sid)) {
                    driverSockets.delete(sid);
                }

                driverLocations.delete(sid);
                driverStatuses.set(sid, 'offline');

                db.query(
                    'UPDATE users SET latitude = NULL, longitude = NULL, last_location_update = NULL WHERE id = $1',
                    [driverId]
                ).catch(err => console.error('Error clearing location on logout:', err.message));

                io.to('managers').emit('driver-offline', { driverId });
                io.emit('driver-status-changed', { driverId, status: 'offline' });
            }
        });

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
            if (socket.driverId) {
                const driverId = socket.driverId;
                const sid = String(driverId);

                if (driverSockets.has(sid)) {
                    const sockets = driverSockets.get(sid);
                    sockets.delete(socket.id);

                    if (sockets.size === 0) {
                        driverSockets.delete(sid);
                        driverStatuses.set(sid, 'offline');
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
};
