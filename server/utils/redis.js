const Redis = require('ioredis');
const logger = require('./logger');

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_REDIS_RETRIES = Number(process.env.REDIS_MAX_RETRIES || 20);
const RECONNECT_LOG_INTERVAL_MS = 60000;

// Auto-fix: Upstash requires rediss:// (TLS). If the URL has the wrong scheme, correct it silently.
if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
    redisUrl = redisUrl.replace(/^redis:\/\//, 'rediss://');
    logger.warn('⚠️  Auto-corrected Upstash REDIS_URL to use rediss:// (TLS required by Upstash)');
}

// تكوين Redis مع دعم SSL و Timeout للـ Upstash أو أي Redis سحابي
// Detect Upstash quota-exceeded — stop all retries immediately to avoid wasting the daily budget.
let _quotaExceeded = false;
let _redisDisabled = false;
let _lastReconnectLogAt = 0;

const client = new Redis(redisUrl, {
    tls: { 
        rejectUnauthorized: false 
    },
    connectTimeout: 20000,
    maxRetriesPerRequest: null, // required by BullMQ
    retryStrategy(times) {
        if (_quotaExceeded || _redisDisabled) return null; // abort immediately on quota/fatal state
        if (times > MAX_REDIS_RETRIES) {
            _redisDisabled = true;
            logger.error(`🚫 Redis reconnect attempts exceeded (${MAX_REDIS_RETRIES}). Redis disabled for this process lifetime.`);
            return null;
        }
        const delay = Math.min(times * 250, 5000);
        return delay;
    },
    lazyConnect: true,
    // Prevent unbounded memory growth when Redis is down.
    enableOfflineQueue: false,
    autoResendUnfulfilledCommands: false,
});

client.on('error', (err) => {
    // Upstash daily quota exhausted → stop all retries immediately
    if (err.message && err.message.includes('max requests limit exceeded')) {
        if (!_quotaExceeded) {
            _quotaExceeded = true;
            logger.error('🚫 Upstash Redis daily quota exceeded. Disabling Redis until quota resets (midnight UTC).');
            client.disconnect();
        }
        return;
    }
    if (err.message && /WRONGPASS|NOAUTH|invalid password|ENOTFOUND/i.test(err.message)) {
        _redisDisabled = true;
        logger.error(`🚫 Redis configuration/auth error detected (${err.message}). Redis disabled until next deploy/restart.`);
        client.disconnect();
        return;
    }
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
    const now = Date.now();
    if (now - _lastReconnectLogAt >= RECONNECT_LOG_INTERVAL_MS) {
        _lastReconnectLogAt = now;
        logger.info('🔄 Reconnecting to Redis...');
    }
});

/**
 * Attempts to connect to Redis.
 * @returns {Promise<boolean>} true if connected successfully, false otherwise
 */
const connectRedis = async () => {
    try {
        if (_redisDisabled) return false;
        await client.connect();
        return true;
    } catch (error) {
        // Quota exceeded is a temporary condition — do NOT crash the process
        if (error.message && error.message.includes('max requests limit exceeded')) {
            _quotaExceeded = true;
            logger.error('🚫 Upstash Redis daily quota exceeded on connect. Running without Redis until quota resets.');
            return false;
        }
        logger.warn('Redis unavailable - caching, queue adapter, and background jobs disabled.');
        return false;
    }
};

const isQuotaExceeded = () => _quotaExceeded;

module.exports = { client, connectRedis, isQuotaExceeded };
