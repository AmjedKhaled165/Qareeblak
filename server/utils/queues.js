const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('./logger');
const fcmService = require('../services/fcm.service');
const db = require('../db');

// All ioredis/BullMQ construction is deferred — no connection is created at
// module load time. This prevents ECONNREFUSED errors being printed to stderr
// when Redis is unavailable. initializeWorkers() is the gated entry point.
let _notificationQueue = null;
let _maintenanceQueue = null;

// Safe no-op helper — works whether workers are initialized or not
const addNotificationJob = async (data) => {
    if (!_notificationQueue) return;
    try {
        await _notificationQueue.add('send-notification', data);
        logger.debug('Notification job added to queue:', data.type);
    } catch (err) {
        logger.warn('Notification job skipped (queue error):', err.message);
    }
};

// Called from index.js ONLY after connectRedis() succeeds
const initializeWorkers = async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Create a dedicated Redis connection for BullMQ with Upstash specifications
    const connection = new IORedis(redisUrl, {
        tls: { 
            rejectUnauthorized: false // To accept Upstash SSL
        },
        connectTimeout: 20000, // 20 seconds to connect
        maxRetriesPerRequest: null, // ⚠️ Most important line! Required for BullMQ
        retryStrategy: (times) => {
            // Gradual reconnection attempts
            if (times > 3) return null; // stop after 3 attempts
            return Math.min(times * 500, 2000);
        },
        enableOfflineQueue: true // Keep requests during disconnection
    });

    connection.on('error', (err) => {
        logger.warn('BullMQ Redis error:', err.message);
    });
    
    connection.on('ready', () => {
        logger.info('✅ BullMQ Redis connection established');
    });

    _notificationQueue = new Queue('notifications', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 1000,
        }
    });

    const worker = new Worker('notifications', async (job) => {
        const { type, userId, message, data, orderId, status } = job.data;
        logger.info(`[Worker] Processing notification job ${job.id}: ${type}`);

        try {
            switch (type) {
                case 'PUSH':
                    await fcmService.sendPushToUser(userId, {
                        notification: { title: 'قريبلك', body: message },
                        data: data || {}
                    });
                    break;
                case 'ORDER_UPDATE':
                    await fcmService.sendOrderStatusUpdate(userId, orderId, status);
                    break;
                case 'SMS':
                    logger.info(`[Worker] SMS would be sent to User ${userId}: ${message}`);
                    break;
                default:
                    logger.warn(`Unknown notification type: ${type}`);
            }
        } catch (err) {
            logger.error(`Error processing job ${job.id}:`, err);
            throw err; // triggers BullMQ retry
        }
    }, { connection });

    // To catch any Errors and prevent app termination
    worker.on('error', err => {
        logger.error('BullMQ Worker Error:', err);
    });
    worker.on('completed', (job) => logger.debug(`Job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Job ${job.id} failed: ${err.message}`));
    // ==========================================
    // MAINTENANCE QUEUE: Scheduled cleanup jobs
    // ==========================================
    _maintenanceQueue = new Queue('maintenance', {
        connection,
        defaultJobOptions: {
            attempts: 2,
            backoff: { type: 'fixed', delay: 60000 },
            removeOnComplete: true,
            removeOnFail: 100,
        }
    });

    // Worker: Guest account pruning + general DB maintenance
    const maintenanceWorker = new Worker('maintenance', async (job) => {
        if (job.name === 'cleanup-guest-accounts') {
            const result = await db.query(`
                DELETE FROM users
                WHERE user_type = 'customer'
                AND email LIKE 'guest_%@qareeblak.com'
                AND created_at < NOW() - INTERVAL '7 days'
                AND id NOT IN (
                    SELECT DISTINCT user_id FROM bookings
                    WHERE user_id IS NOT NULL
                )
            `);
            logger.info(`[Maintenance] Guest cleanup: removed ${result.rowCount} stale guest accounts`);
        }
    }, { connection });

    maintenanceWorker.on('error', err => {
        logger.error('BullMQ Maintenance Worker Error:', err);
    });
    maintenanceWorker.on('failed', (job, err) => logger.error(`[Maintenance] Job ${job?.id} failed: ${err.message}`));

    // Schedule daily guest cleanup at 3AM (cron: 0 3 * * *)
    // BullMQ repeat pattern uses cron syntax
    await _maintenanceQueue.add(
        'cleanup-guest-accounts',
        {},
        { repeat: { pattern: '0 3 * * *' } }
    );
    logger.info('✅ BullMQ maintenance worker started (Guest cleanup scheduled at 3AM daily)');

    logger.info('✅ BullMQ notification worker started');
};

module.exports = {
    get notificationQueue() { return _notificationQueue; },
    addNotificationJob,
    initializeWorkers
};
