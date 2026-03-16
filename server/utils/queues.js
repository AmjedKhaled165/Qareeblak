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
    let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const isTlsRedis = /^rediss:\/\//i.test(redisUrl);
    let redisHost = null;
    try {
        redisHost = new URL(redisUrl).hostname;
    } catch (_) {
        redisHost = null;
    }

    // Auto-fix: Upstash requires rediss:// (TLS) — guard against misconfigured env vars.
    if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
        redisUrl = redisUrl.replace(/^redis:\/\//, 'rediss://');
        logger.warn('⚠️  BullMQ: Auto-corrected Upstash REDIS_URL to rediss://');
    }

    // Create a dedicated Redis connection for BullMQ with Upstash specifications
    let _bullQuotaExceeded = false;

    const connection = new IORedis(redisUrl, {
        ...(isTlsRedis ? {
            tls: {
                rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
                ...(redisHost ? { servername: redisHost } : {}),
            }
        } : {}),
        connectTimeout: 20000,
        maxRetriesPerRequest: null, // ⚠️ Required for BullMQ
        retryStrategy: (times) => {
            if (_bullQuotaExceeded) return null; // abort immediately
            if (times > 3) return null;
            return Math.min(times * 500, 2000);
        },
        enableOfflineQueue: false // Don't queue commands when disconnected
    });

    // Test connection before initializing workers
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('BullMQ Redis connect timeout')), 15000);
        connection.once('ready', () => { clearTimeout(timeout); resolve(); });
        connection.once('error', (err) => {
            clearTimeout(timeout);
            if (err.message && err.message.includes('max requests limit exceeded')) {
                _bullQuotaExceeded = true;
                reject(new Error('Upstash quota exceeded — skipping BullMQ workers'));
            } else {
                reject(err);
            }
        });
        connection.connect().catch(reject);
    });

    connection.on('error', (err) => {
        if (err.message && err.message.includes('max requests limit exceeded')) {
            if (!_bullQuotaExceeded) {
                _bullQuotaExceeded = true;
                logger.error('🚫 BullMQ: Upstash quota exceeded — closing all workers.');
                connection.disconnect();
            }
            return;
        }
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

    // Circuit breaker: mute & close worker after 5 rapid errors to prevent memory flood
    let _notifErrors = 0; let _notifErrorWindow = Date.now();
    worker.on('error', err => {
        const now = Date.now();
        if (now - _notifErrorWindow > 60000) { _notifErrors = 0; _notifErrorWindow = now; }
        _notifErrors++;
        if (_notifErrors <= 5) {
            logger.error('BullMQ Worker Error:', err.message);
        } else if (_notifErrors === 6) {
            logger.error('BullMQ Worker: too many errors — closing worker to prevent memory flood.');
            worker.close(true).catch(() => {});
        }
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

    // Circuit breaker: silence & close after 5 rapid errors to prevent the memory-flooding loop
    let _maintErrors = 0; let _maintErrorWindow = Date.now();
    maintenanceWorker.on('error', err => {
        const now = Date.now();
        if (now - _maintErrorWindow > 60000) { _maintErrors = 0; _maintErrorWindow = now; }
        _maintErrors++;
        if (_maintErrors <= 5) {
            logger.error('BullMQ Maintenance Worker Error:', err.message);
        } else if (_maintErrors === 6) {
            logger.error('BullMQ Maintenance Worker: too many errors — closing worker to prevent memory flood.');
            maintenanceWorker.close(true).catch(() => {});
        }
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
