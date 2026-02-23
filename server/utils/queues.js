const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('./logger');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
});

// 1. Initialize Queues
const notificationQueue = new Queue('notifications', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 1000,
    }
});

// 2. Add Notification Job Helper
const addNotificationJob = async (data) => {
    try {
        await notificationQueue.add('send-notification', data);
        logger.debug('Notification job added to queue:', data.type);
    } catch (err) {
        logger.error('Failed to add notification job to queue:', err);
    }
};

const fcmService = require('../services/fcm.service');

// 3. Worker Implementation (Background Job Consumer)
// Note: In a real production setup, workers might run in a separate process
const initializeWorkers = () => {
    const worker = new Worker('notifications', async (job) => {
        const { type, userId, message, data, orderId, status } = job.data;
        logger.info(`[Worker] Processing notification job ${job.id}: ${type}`);

        // Strategy pattern for different notification types
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
            throw err; // Trigger BullMQ retry
        }
    }, { connection });

    worker.on('completed', (job) => logger.debug(`Job ${job.id} completed`));
    worker.on('failed', (job, err) => logger.error(`Job ${job.id} failed: ${err.message}`));
};

module.exports = {
    notificationQueue,
    addNotificationJob,
    initializeWorkers
};
