const { createClient } = require('redis');
const logger = require('./logger');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const client = createClient({ url: redisUrl });

client.on('error', (err) => logger.error('Redis Client Error', err));
client.on('connect', () => logger.info('Connected to Redis'));

const connectRedis = async () => {
    try {
        await client.connect();
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        // Don't exit process if local dev, but for prod it's critical
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

module.exports = {
    client,
    connectRedis
};
