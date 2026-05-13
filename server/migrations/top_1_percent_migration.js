/**
 * Top 1% Migration: The Resilient Infrastructure
 * Includes Outbox with Backoff, Cleanup, and Hashing Normalization Support
 */
const db = require('../db');
const logger = require('../utils/logger');

async function runFinalEliteMigration() {
    const query = (text, params) => db.query(text, params);
    
    try {
        logger.info('🚀 Starting Top 1% Infrastructure Migration...');

        // 1. Hardened Idempotency with User Isolation
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

        // 2. Resilient Outbox with Lifecycle Management
        await query(`DROP TABLE IF EXISTS outbox_events CASCADE`);
        await query(`
            CREATE TABLE outbox_events (
                id BIGSERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                payload JSONB NOT NULL,
                status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed (DLQ)
                attempts INTEGER DEFAULT 0,
                last_error TEXT,
                next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Indexes for High-Performance Polling
        await query(`CREATE INDEX idx_outbox_polling ON outbox_events(status, next_run_at) WHERE status = 'pending'`);
        await query(`CREATE INDEX idx_outbox_cleanup ON outbox_events(processed_at) WHERE status = 'processed'`);

        logger.info('✨ Infrastructure is now Top 1% standard.');
        return true;
    } catch (err) {
        logger.error('❌ Final Migration Failed:', err);
        return false;
    }
}

module.exports = runFinalEliteMigration;
