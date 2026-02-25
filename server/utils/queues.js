const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('./logger');
const fcmService = require('../services/fcm.service');

// All ioredis/BullMQ construction is deferred — no connection is created at
// module load time. This prevents ECONNREFUSED errors being printed to stderr
// when Redis is unavailable. initializeWorkers() is the gated entry point.
let _notificationQueue = null;

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
const initializeWorkers = () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        // Single reconnect attempt — if Redis dies after startup, fail fast
        retryStrategy: (times) => (times < 3 ? Math.min(times * 500, 2000) : null)
    });

    connection.on('error', (err) => {
        logger.warn('BullMQ Redis error:', err.message);
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

    worker.on('completed', (job) => logger.debug(`Job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Job ${job.id} failed: ${err.message}`));
    logger.info('✅ BullMQ notification worker started');
};

module.exports = {
    get notificationQueue() { return _notificationQueue; },
    addNotificationJob,
    initializeWorkers
};
