const Redis = require('ioredis');
const logger = require('./logger');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// تكوين Redis مع دعم SSL و Timeout للـ Upstash أو أي Redis سحابي
const client = new Redis(redisUrl, {
    tls: { 
        // تخطي مشاكل شهادات SSL في البيئات السحابية
        rejectUnauthorized: false 
    },
    connectTimeout: 20000, // 20 ثانية للاتصال
    maxRetriesPerRequest: null, // مهم لـ BullMQ
    retryStrategy(times) {
        // محاولة إعادة الاتصال بشكل تدريجي
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    // إيقاف إعادة المحاولة التلقائية بعد عدد معين من المرات
    lazyConnect: true, // الاتصال يدوياً عند الحاجة
    enableOfflineQueue: true, // الاحتفاظ بالطلبات أثناء انقطاع الاتصال
});

client.on('error', (err) => {
    // تسجيل الخطأ مرة واحدة فقط لتجنب الازعاج
    if (!client._warnedOnce) {
        client._warnedOnce = true;
        logger.warn(`Redis unavailable (${err.message}) - caching and real-time adapter disabled.`);
    }
});

client.on('ready', () => {
    client._warnedOnce = false;
    logger.info('✅ Connected to Redis');
});

client.on('connect', () => {
    logger.info('🔌 Redis connection established');
});

client.on('reconnecting', () => {
    logger.info('🔄 Reconnecting to Redis...');
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
