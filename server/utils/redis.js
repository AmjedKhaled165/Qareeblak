const { createClient } = require('redis');
const logger = require('./logger');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({
    url: redisUrl,
    socket: {
        // Return false immediately: attempt once, if it fails, stop. No retry spam.
        reconnectStrategy: () => false
    }
});

client.on('error', (err) => {
    // Only log on the FIRST error to avoid spam
    if (!client._warnedOnce) {
        client._warnedOnce = true;
        logger.warn(`Redis unavailable (${err.message}) - caching and real-time adapter disabled.`);
    }
});
client.on('ready', () => {
    client._warnedOnce = false;
    logger.info('\u2705 Connected to Redis');
});

/**
 * Attempts to connect to Redis.
 * @returns {Promise<boolean>} true if connected successfully, false otherwise
 */
const connectRedis = async () => {
    try {
        await client.connect();
        return true;
    } catch (error) {
        logger.warn('Redis unavailable - caching, queue adapter, and background jobs disabled.');
        if (process.env.NODE_ENV === 'production') {
            logger.error('FATAL: Redis is required in production. Exiting.');
            process.exit(1);
        }
        return false;
    }
};

module.exports = { client, connectRedis };
