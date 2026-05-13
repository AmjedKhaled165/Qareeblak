/**
 * Elite Migration: Transactional Outbox & Hardened Idempotency
 */
const db = require('../db');
const logger = require('../utils/logger');

async function runEliteMigration() {
    const query = (text, params) => db.query(text, params);
    
    try {
        logger.info('🚀 Starting Elite Architecture Migration...');

        // 1. Hardened Idempotency Table
        await query(`DROP TABLE IF EXISTS idempotency_keys CASCADE`);
        await query(`
            CREATE TABLE idempotency_keys (
                key TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                request_hash TEXT NOT NULL,
                response_data JSONB,
                status VARCHAR(20) DEFAULT 'processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (key, user_id)
            )
        `);

        // 2. Transactional Outbox Table
        await query(`
            CREATE TABLE IF NOT EXISTS outbox_events (
                id BIGSERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                payload JSONB NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                last_error TEXT,
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'pending'`);

        logger.info('✨ Elite Migration completed.');
        return true;
    } catch (err) {
        logger.error('❌ Elite Migration Failed:', err);
        return false;
    }
}

module.exports = runEliteMigration;
