const { client: redis } = require('./redis');
const db = require('../db');
const logger = require('./logger');
const crypto = require('crypto');

/**
 * [ELITE++] Financial-Grade Deterministic Normalization
 * Handles Floats, Dates, and Nulls to ensure identical financial meaning = identical hash
 */
function eliteNormalize(val, depth = 0) {
    if (depth > 10) throw new Error('Payload too deep (Security Block)');
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    
    // Normalize Numbers: 10, 10.0, 10.0000001 -> fixed precision string
    if (typeof val === 'number') return val.toFixed(8);
    
    if (Array.isArray(val)) return val.map(item => eliteNormalize(item, depth + 1));
    
    if (typeof val === 'object') {
        return Object.keys(val).sort().reduce((acc, key) => {
            acc[key] = eliteNormalize(val[key], depth + 1);
            return acc;
        }, {});
    }
    
    return val;
}

function getEliteHash(body) {
    const normalized = eliteNormalize(body || {});
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

async function withEliteLock(req, idempotencyKey, action) {
    const userId = req.user.id;
    const requestHash = getEliteHash(req.body);
    
    const pgLockId = (100 << 24) | (parseInt(userId) & 0xFFFFFF);
    const lockKey = `lock:checkout:${userId}`;
    const useRedis = redis && redis.status === 'ready';

    if (useRedis) {
        try {
            const acquired = await redis.set(lockKey, 'LOCKED', 'PX', 30000, 'NX');
            if (!acquired) throw new Error('PROCESS_IN_PROGRESS');
        } catch (err) {
            if (err.message === 'PROCESS_IN_PROGRESS') throw err;
            logger.warn(`Redis lock skipped: ${err.message}`);
        }
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const pgLock = await client.query('SELECT pg_try_advisory_xact_lock($1) as acquired', [pgLockId]);
        if (!pgLock.rows[0].acquired) throw new Error('PROCESS_IN_PROGRESS');

        if (idempotencyKey) {
            const dbIdem = await client.query(
                'SELECT response_data, status, request_hash FROM idempotency_keys WHERE key = $1 AND user_id = $2 FOR UPDATE', 
                [idempotencyKey, userId]
            );

            if (dbIdem.rows.length > 0) {
                const record = dbIdem.rows[0];
                if (record.request_hash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSE_DETECTED');
                if (record.status === 'processing') throw new Error('PROCESS_IN_PROGRESS');
                await client.query('ROLLBACK');
                return record.response_data;
            }

            await client.query(
                'INSERT INTO idempotency_keys (key, user_id, request_hash, status) VALUES ($1, $2, $3, $4)', 
                [idempotencyKey, userId, requestHash, 'processing']
            );
        }

        const result = await action(client);

        if (idempotencyKey) {
            await client.query(
                'UPDATE idempotency_keys SET response_data = $1, status = $2 WHERE key = $3 AND user_id = $4',
                [JSON.stringify(result), 'completed', idempotencyKey, userId]
            );
        }

        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        if (idempotencyKey && err.message !== 'PROCESS_IN_PROGRESS' && err.message !== 'IDEMPOTENCY_KEY_REUSE_DETECTED') {
            const cleanupClient = await db.connect();
            try {
                await cleanupClient.query('DELETE FROM idempotency_keys WHERE key = $1 AND user_id = $2 AND status = $3', [idempotencyKey, userId, 'processing']);
            } finally {
                cleanupClient.release();
            }
        }
        throw err;
    } finally {
        client.release();
        if (useRedis) await redis.del(lockKey).catch(() => {});
    }
}

module.exports = { withEliteLock };
