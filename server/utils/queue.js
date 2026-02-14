const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('./logger');

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null
});

/**
 * Enterprise Job Queue System (BullMQ)
 * Offloads heavy tasks from the main thread to ensure sub-second API responses.
 */
const notificationQueue = new Queue('notifications', { connection });

const addNotificationJob = async (userId, message, type) => {
    await notificationQueue.add('send_push', { userId, message, type }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
    });
};

// Worker implementation
const worker = new Worker('notifications', async job => {
    if (job.name === 'send_push') {
        const { userId, message, type } = job.data;
        // In reality, this would call Firebase Cloud Messaging (FCM)
        logger.info(`[Queue] Processing Notification for User ${userId}: ${message}`);
        // await fcmService.send(userId, message);
    }
}, { connection });

worker.on('completed', job => logger.info(`[Queue] Job ${job.id} completed`));
worker.on('failed', (job, err) => logger.error(`[Queue] Job ${job?.id} failed: ${err.message}`));

module.exports = { addNotificationJob, notificationQueue };
