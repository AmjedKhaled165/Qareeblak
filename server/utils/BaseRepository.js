const db = require('../db');
const { getCache, setCache } = require('./redis-cache');
const resilience = require('./resilience');
const logger = require('./logger');

/**
 * Enterprise Base Repository
 * Implements Caching-Aside and Circuit Breaker patterns.
 * This is how large scale apps maintain 99.9% uptime.
 */
class BaseRepository {
    constructor(tableName, cachePrefix) {
        this.tableName = tableName;
        this.cachePrefix = cachePrefix;
    }

    /**
     * Execute query with Circuit Breaker
     */
    async executeGuarded(name, query, params = []) {
        return resilience.fire(`db:${this.tableName}:${name}`, async () => {
            const result = await db.query(query, params);
            return result.rows;
        });
    }

    /**
     * Find by ID with Cache-Aside pattern
     */
    async findById(id, ttl = 600) {
        const cacheKey = `${this.cachePrefix}:${id}`;

        // 1. Try Cache
        const cached = await getCache(cacheKey);
        if (cached) return cached;

        // 2. Try Database with Resilience
        const rows = await this.executeGuarded('findById',
            `SELECT * FROM ${this.tableName} WHERE id = $1`, [id]
        );

        if (rows.length > 0) {
            // 3. Update Cache
            await setCache(cacheKey, rows[0], ttl);
            return rows[0];
        }

        return null;
    }

    /**
     * Delete and Invalidate Cache (Write-Through)
     */
    async delete(id) {
        const result = await db.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
        await setCache(`${this.cachePrefix}:${id}`, null); // Invalidate
        return result.rowCount > 0;
    }
}

module.exports = BaseRepository;
