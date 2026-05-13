const { client: redis } = require('./redis');
const logger = require('./logger');

/**
 * Enterprise Distributed Locking Utility
 * Uses Redis Atomic SET with NX and PX (expires) to coordinate across multiple Node instances.
 */
class DistributedLock {
    /**
     * @param {string} resource - Key to lock
     * @param {number} ttlMs - Duration of the lock in ms
     * @returns {Promise<string|null>} Lock token if successful, null otherwise
     */
    async acquire(resource, ttlMs = 10000) {
        if (redis.status !== 'ready') return null;

        const token = Math.random().toString(36).substring(2);
        const lockKey = `lock:${resource}`;

        try {
            // SET lock:key token NX PX ttl
            const acquired = await redis.set(lockKey, token, {
                NX: true,
                PX: ttlMs
            });

            if (acquired) {
                logger.info(`\ud83d\udd12 [Lock] Acquired for ${resource}`);
                return token;
            }
            return null;
        } catch (err) {
            logger.error(`[Lock] Failed to acquire for ${resource}:`, err);
            return null;
        }
    }

    /**
     * @param {string} resource - Key to unlock
     * @param {string} token - Original token received on acquire
     */
    async release(resource, token) {
        if (redis.status !== 'ready') return;

        const lockKey = `lock:${resource}`;

        // Lua script to ensure atomicity: only delete if the token matches
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;

        try {
            await redis.eval(script, {
                KEYS: [lockKey],
                ARGV: [token]
            });
            logger.info(`\ud83d\udd13 [Lock] Released for ${resource}`);
        } catch (err) {
            logger.error(`[Lock] Failed to release for ${resource}:`, err);
        }
    }
}

module.exports = new DistributedLock();
