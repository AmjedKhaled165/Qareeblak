const db = require('../db');
const logger = require('../utils/logger');
const { client: redisClient } = require('../utils/redis');

// In-memory state for driver locations
const driverLocations = new Map();
const driverStatuses = new Map();
const driverSockets = new Map();
const lastDbUpdateTimes = new Map();

async function setRedisDriverLocation(driverId, locationData) {
    try {
        if (redisClient && redisClient.status === 'ready') {
            await redisClient.hset('driver_locations', String(driverId), JSON.stringify(locationData));
            await redisClient.expire('driver_locations', 86400); // 24 hours TTL
        }
    } catch (e) {
        logger.warn('Failed to set driver location in Redis: ' + e.message);
    }
}

async function setRedisDriverStatus(driverId, status) {
    try {
        if (redisClient && redisClient.status === 'ready') {
            await redisClient.hset('driver_statuses', String(driverId), status);
            await redisClient.expire('driver_statuses', 86400); // 24 hours TTL
        }
    } catch (e) {
        logger.warn('Failed to set driver status in Redis: ' + e.message);
    }
}

async function deleteRedisDriver(driverId) {
    try {
        if (redisClient && redisClient.status === 'ready') {
            await redisClient.hdel('driver_locations', String(driverId));
            await redisClient.hdel('driver_statuses', String(driverId));
        }
    } catch (e) {
        logger.warn('Failed to delete driver from Redis: ' + e.message);
    }
}


/**
 * Register all Socket.io handlers
 * @param {Server} io - Socket.io Server instance
 */
module.exports = function registerSocketHandlers(io) {
    // Only clear locations older than 24 hours (not on every startup)
    const clearStaleLocations = async () => {
        try {
            logger.info('Clearing driver locations older than 24 hours...');
            const result = await db.query(`
                UPDATE users 
                SET latitude = NULL, longitude = NULL, is_available = false 
                WHERE user_type = 'partner_courier' 
                AND last_location_update < NOW() - INTERVAL '24 hours'
            `);
            logger.info(`Cleared ${result.rowCount} stale driver locations`);
        } catch (error) {
            if (error?.code === '42P01') {
                logger.warn('Skipping stale driver cleanup on first run: core tables are not ready yet.');
            } else {
                logger.error('Failed to clear stale driver locations:', error.stack || error.message || error);
            }
        }
    };

    // Clear stale locations on startup
    clearStaleLocations();

    // Run cleanup every hour
    setInterval(clearStaleLocations, 60 * 60 * 1000);

    io.on('connection', (socket) => {
        logger.info('Client connected:', socket.id);

        // ========== CHAT HANDLERS ==========
        // Join a consultation chat room
        socket.on('join-consultation', (consultationId) => {
            const roomName = `chat-${consultationId}`;
            socket.join(roomName);
            logger.info(`Client joined chat: ${roomName}`);
        });

        // Leave a consultation chat room
        socket.on('leave-consultation', (consultationId) => {
            const roomName = `chat-${consultationId}`;
            socket.leave(roomName);
            logger.info(`Client left chat: ${roomName}`);
        });

        // ========== MANAGERS TRACKING ==========


        socket.on('leave-managers', () => {
            socket.leave('managers');
            logger.info(`Client left managers room: ${socket.id}`);
        });

        // Send message via Socket.io
        socket.on('send_message', async (data) => {
            try {
                const { consultationId, message, imageUrl, senderId, senderType, senderName } = data;
                logger.info('[Chat] Received send_message event:', { consultationId, senderId, senderType });

                if (!consultationId) {
                    logger.error('[Chat] Missing consultationId in send_message');
                    socket.emit('message_error', { error: 'معرف المحادثة مفقود' });
                    return;
                }

                if (!message && !imageUrl) {
                    logger.error('[Chat] No message or image in send_message');
                    socket.emit('message_error', { error: 'الرسالة أو الصورة مطلوبة' });
                    return;
                }

                // 🛡️ [Security] Disintermediation Protection (Direct Deal Prevention)
                // Filter Egyptian phone numbers (01x xxxx xxxx) and Arabic numerals
                const phoneRegex = /(01[0125][0-9]{8})|(\+201[0125][0-9]{8})|(٠١[٠١٢٥][٠-٩]{٨})/g;
                const cleanMsg = message ? message.replace(/[\s-]/g, '') : '';

                if (message && phoneRegex.test(cleanMsg)) {
                    logger.warn(`🚫 [Chat] Blocked potential disintermediation attempt from User ${senderId}`);
                    socket.emit('message_error', {
                        error: 'ممنوع إرسال أرقام الهواتف حفاظاً على حقوق المنصة وسلامة تعاملك. يمكنك الاتفاق على السعر فقط.'
                    });
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

                logger.info('[Chat] Message saved:', savedMessage.id);

                // Broadcast to all users in the consultation room
                io.to(consultationId).emit('new-message', savedMessage);
                logger.info('[Chat] Message broadcast to room: ' + consultationId);

                // Send confirmation to sender
                socket.emit('message_sent', { success: true, messageId: savedMessage.id });
            } catch (error) {
                logger.error('[Chat] Error in send_message:', error.message);
                socket.emit('message_error', { error: 'حدث خطأ في إرسال الرسالة' });
            }
        });

        // Typing indicator
        socket.on('typing', ({ consultationId, userId, userName }) => {
            try {
                logger.info('[Chat] User typing:', { consultationId, userId, userName });
                socket.to(consultationId).emit('user-typing', { userId, userName });
            } catch (error) {
                logger.error('[Chat] Error broadcasting typing event:', error?.message || error);
            }
        });

        // Stop typing indicator
        socket.on('stop-typing', ({ consultationId, userId }) => {
            try {
                logger.info('[Chat] User stop typing:', { consultationId, userId });
                socket.to(consultationId).emit('user-stop-typing', { userId });
            } catch (error) {
                logger.error('[Chat] Error broadcasting stop-typing event:', error?.message || error);
            }
        });

        // Pharmacist online status
        socket.on('pharmacist-online', (providerId) => {
            try {
                socket.providerId = providerId;
                socket.join(`provider-${providerId}`);
                io.emit('pharmacist-status', { providerId, status: 'online' });
                logger.info(`Pharmacist ${providerId} is now online`);
            } catch (error) {
                logger.error('[Chat] Error setting pharmacist online:', error?.message || error);
            }
        });

        socket.on('pharmacist-offline', (providerId) => {
            try {
                io.emit('pharmacist-status', { providerId, status: 'offline' });
                logger.info(`Pharmacist ${providerId} is now offline`);
            } catch (error) {
                logger.error('[Chat] Error setting pharmacist offline:', error?.message || error);
            }
        });

        // ========== DRIVER LOCATION HANDLERS ==========

        // Driver sends location update
        socket.on('sendLocation', async (data) => {
            const latitude = data.latitude || data.lat;
            const longitude = data.longitude || data.lng;
            let { orderId, courierId, heading, speed, accuracy } = data;

            // Decode courierId if it's an encoded hash from the app
            if (courierId && isNaN(Number(courierId))) {
                try {
                    const { decodeEntityId } = require('../utils/obfuscate');
                    const decoded = decodeEntityId('user', courierId);
                    if (decoded) courierId = decoded;
                } catch (e) {
                    logger.error('Error decoding courierId:', e);
                }
            }

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

                const locationData = {
                    driverId: courierId,
                    latitude,
                    longitude,
                    heading: heading || 0,
                    speed: speed || 0,
                    accuracy: accuracy || 0,
                    timestamp,
                    name: driverName
                };

                driverLocations.set(sid, locationData);
                await setRedisDriverLocation(courierId, locationData);

                if (driverStatuses.get(sid) !== 'online') {
                    driverStatuses.set(sid, 'online');
                    await setRedisDriverStatus(courierId, 'online');
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
                    try {
                        const res = await db.query('SELECT name FROM users WHERE id = $1', [courierId]);
                        if (res.rows.length > 0 && res.rows[0].name) {
                            const name = res.rows[0].name;
                            const current = driverLocations.get(sid);
                            if (current) {
                                const updatedLoc = { ...current, name };
                                driverLocations.set(sid, updatedLoc);
                                await setRedisDriverLocation(courierId, updatedLoc);
                                broadcastLocation(name);
                            }
                        }
                    } catch (err) {
                        logger.error('Error fetching name for driver:', err?.message || err);
                    }
                }

                broadcastLocation();

                // Persist to database, but throttled to at most once every 30 seconds to prevent table bloat & write amplification
                const nowMs = Date.now();
                const lastUpdate = lastDbUpdateTimes.get(sid) || 0;
                if (nowMs - lastUpdate > 30000) {
                    lastDbUpdateTimes.set(sid, nowMs);
                    try {
                        await db.query(
                            'UPDATE users SET latitude = $1, longitude = $2, last_location_update = NOW() WHERE id = $3',
                            [latitude, longitude, courierId]
                        );
                    } catch (err) {
                        logger.error('Error persisting location:', err?.message || err);
                    }
                }

                logger.info(`Location from driver: ${courierId} (${driverName || 'NO NAME'}) at (${latitude}, ${longitude})`);
            }
        });

        // Driver becomes online
        socket.on('driver-online', async (driverId) => {
            if (!driverId) return;
            
            // Decode driverId if it's an encoded hash from the app
            if (driverId && isNaN(Number(driverId))) {
                try {
                    const { decodeEntityId } = require('../utils/obfuscate');
                    const decoded = decodeEntityId('user', driverId);
                    if (decoded) driverId = decoded;
                } catch (e) {}
            }

            const sid = String(driverId);
            socket.driverId = driverId;
            driverStatuses.set(driverId, 'online');
            await setRedisDriverStatus(driverId, 'online');
            logger.info(`Driver ${driverId} is now online`);
            io.emit('driver-status-changed', { driverId, status: 'online' });

            if (driverLocations.has(driverId)) {
                io.to(`driver-${driverId}`).emit('updateLocation', driverLocations.get(driverId));
            } else {
                try {
                    if (redisClient && redisClient.status === 'ready') {
                        const locStr = await redisClient.hget('driver_locations', sid);
                        if (locStr) {
                            const loc = JSON.parse(locStr);
                            driverLocations.set(sid, loc);
                            io.to(`driver-${driverId}`).emit('updateLocation', loc);
                        }
                    }
                } catch (_) {}
            }
        });

        // Manager joins to track a driver
        socket.on('join-driver-tracking', async (driverId) => {
            socket.join(`driver-${driverId}`);
            logger.info(`Manager joined tracking for driver: ${driverId}`);

            const sid = String(driverId);
            if (driverStatuses.has(driverId)) {
                socket.emit('driver-status-changed', { driverId, status: driverStatuses.get(driverId) });
            } else {
                try {
                    if (redisClient && redisClient.status === 'ready') {
                        const status = await redisClient.hget('driver_statuses', sid);
                        if (status) {
                            socket.emit('driver-status-changed', { driverId, status });
                        }
                    }
                } catch (_) {}
            }

            if (driverLocations.has(driverId)) {
                socket.emit('updateLocation', driverLocations.get(driverId));
            } else {
                try {
                    if (redisClient && redisClient.status === 'ready') {
                        const locStr = await redisClient.hget('driver_locations', sid);
                        if (locStr) {
                            socket.emit('updateLocation', JSON.parse(locStr));
                        }
                    }
                } catch (_) {}
            }
        });

        // Manager joins to track ALL drivers (Fleet Map)
        socket.on('join-managers', async () => {
            socket.join('managers');
            logger.info('Manager joined global fleet tracking');

            // Send local in-memory locations first
            driverLocations.forEach((location, driverId) => {
                socket.emit('updateLocation', { ...location, driverId });
            });

            // Fetch other driver locations from Redis (horizontal scale sync)
            try {
                if (redisClient && redisClient.status === 'ready') {
                    const allLocations = await redisClient.hgetall('driver_locations');
                    if (allLocations) {
                        Object.entries(allLocations).forEach(([dId, locStr]) => {
                            if (!driverLocations.has(dId)) {
                                try {
                                    socket.emit('updateLocation', JSON.parse(locStr));
                                } catch (_) {}
                            }
                        });
                    }
                }
            } catch (err) {
                logger.warn('Failed to sync global locations from Redis on join-managers: ' + err.message);
            }
        });

        // Customer joins order tracking
        socket.on('join-tracking', (orderId) => {
            socket.join(`order-${orderId}`);
            logger.info(`Client joined order tracking: order-${orderId}`);
        });

        // ==========================================
        // TARGETED USER ROOMS (To prevent broadcast storms)
        // ==========================================
        socket.on('user-join', ({ userId, userType }) => {
            if (userId) {
                socket.join(`user-${userId}`);
                logger.info(`Client joined user room: user-${userId} (${userType || 'unknown'})`);
            }
        });

        // Driver explicitly logs out
        socket.on('driver-logout', async (driverId) => {
            if (driverId) {
                const sid = String(driverId);
                logger.info(`Driver ${driverId} logged out, clearing location`);

                if (driverSockets.has(sid)) {
                    driverSockets.delete(sid);
                }

                driverLocations.delete(sid);
                driverStatuses.set(sid, 'offline');
                lastDbUpdateTimes.delete(sid);
                await deleteRedisDriver(driverId);

                db.query(
                    'UPDATE users SET latitude = NULL, longitude = NULL, last_location_update = NULL WHERE id = $1',
                    [driverId]
                ).catch(err => logger.error('Error clearing location on logout:', err?.message || err));

                io.to('managers').emit('driver-offline', { driverId });
                io.emit('driver-status-changed', { driverId, status: 'offline' });
            }
        });

        socket.on('disconnect', async () => {
            logger.info('Client disconnected:', socket.id);
            if (socket.driverId) {
                const driverId = socket.driverId;
                const sid = String(driverId);

                if (driverSockets.has(sid)) {
                    const sockets = driverSockets.get(sid);
                    sockets.delete(socket.id);

                    if (sockets.size === 0) {
                        driverSockets.delete(sid);
                        driverStatuses.set(sid, 'offline');
                        lastDbUpdateTimes.delete(sid);
                        await setRedisDriverStatus(driverId, 'offline');
                        io.to('managers').emit('driver-status-changed', { driverId, status: 'offline' });
                        io.emit('driver-status-changed', { driverId, status: 'offline' });
                        logger.info(`Driver ${driverId} is now offline (no more sockets) - location preserved`);
                    } else {
                        logger.info(`Driver ${driverId} disconnected one socket but remains online (${sockets.size} left)`);
                    }
                }
            }
        });
    });
};
