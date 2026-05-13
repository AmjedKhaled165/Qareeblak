// Redis Caching Utility for Performance Optimization
// Reduces database load by 80%+ for frequent GET requests

const { client: redis } = require('./redis'); // Your existing redis connection
const logger = require('./logger');

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Parsed cached data or null
 */
async function getCache(key) {
    try {
        if (!redis || redis.status !== 'ready') {
            logger.warn('[Cache] Redis not available, skipping cache');
            return null;
        }

        const cached = await redis.get(key);
        if (!cached) return null;

        return JSON.parse(cached);
    } catch (error) {
        logger.error(`[Cache] Error getting key "${key}": ${error.message}`);
        return null; // Fail gracefully - don't break the app
    }
}

/**
 * Set cached value with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON.stringify'd)
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
async function setCache(key, value, ttl = 300) {
    try {
        if (!redis || redis.status !== 'ready') {
            logger.warn('[Cache] Redis not available, skipping cache set');
            return false;
        }

        // If value is null/undefined, delete the key (cache invalidation)
        if (value === null || value === undefined) {
            await redis.del(key);
            return true;
        }

        await redis.set(key, JSON.stringify(value), 'EX', ttl);
        return true;
    } catch (error) {
        logger.error(`[Cache] Error setting key "${key}": ${error.message}`);
        return false; // Fail gracefully
    }
}

/**
 * Invalidate cache by pattern (USE SPARINGLY - expensive operation)
 * @param {string} pattern - Pattern to match (e.g., 'providers:*')
 * @returns {Promise<number>} Number of keys deleted
 */
async function invalidatePattern(pattern) {
    try {
        if (!redis || redis.status !== 'ready') {
            return 0;
        }

        const keys = await redis.keys(pattern);
        if (keys.length === 0) return 0;

        await redis.del(...keys);
        logger.info(`[Cache] Invalidated ${keys.length} keys matching "${pattern}"`);
        return keys.length;
    } catch (error) {
        logger.error(`[Cache] Error invalidating pattern "${pattern}": ${error.message}`);
        return 0;
    }
}

/**
 * Cache middleware for Express routes
 * Usage: router.get('/path', cacheMiddleware(300), handler)
 * @param {number} ttl - Cache TTL in seconds
 * @returns {Function} Express middleware
 */
function cacheMiddleware(ttl = 300) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Normalize URL to prevent Cache Exhaustion (Cache Poisoning) Attacks
        // Attackers could send ?rand=1, ?rand=2 to fill Redis RAM. We must filter them.
        const urlObj = new URL(req.originalUrl, `http://${req.headers.host}`);

        // Allowed query parameters for caching
        const allowedParams = ['page', 'limit', 'sort', 'category', 'status', 'providerId', 'userId', 'search', 'date'];

        const filteredParams = new URLSearchParams();
        urlObj.searchParams.forEach((value, key) => {
            if (allowedParams.includes(key)) {
                filteredParams.append(key, value);
            }
        });

        // Reconstruct safe URL path + sorted query parameters
        filteredParams.sort(); // Ensure ?a=1&b=2 is the same as ?b=2&a=1
        const safeQueryString = filteredParams.toString();
        const normalizedUrl = safeQueryString ? `${urlObj.pathname}?${safeQueryString}` : urlObj.pathname;

        // Build cache key from normalized URL
        const cacheKey = `route:${normalizedUrl}`;

        try {
            const cached = await getCache(cacheKey);
            if (cached) {
                logger.info(`[Cache HIT] ${req.originalUrl}`);
                return res.json(cached);
            }

            // Override res.json to cache response
            const originalJson = res.json.bind(res);
            res.json = function (body) {
                // Only cache successful responses
                if (res.statusCode === 200) {
                    setCache(cacheKey, body, ttl).catch(err =>
                        logger.error(`[Cache] Failed to cache response: ${err.message}`)
                    );
                }
                return originalJson(body);
            };

            next();
        } catch (error) {
            logger.error(`[Cache Middleware] Error: ${error.message}`);
            next(); // Continue without cache on error
        }
    };
}

module.exports = {
    getCache,
    setCache,
    invalidatePattern,
    cacheMiddleware
};
