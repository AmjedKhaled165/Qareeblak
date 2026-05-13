/**
 * Senior++ Migration: Fix Chat Types & Add Idempotency Table
 * 1. Converts Chat IDs to VARCHAR safely
 * 2. Restores Foreign Key integrity
 * 3. Creates Postgres-backed idempotency table
 */
const db = require('../db');
const logger = require('../utils/logger');

async function runSeniorMigration() {
    const query = (text, params) => db.query(text, params);
    
    try {
        logger.info('🚀 Starting Senior++ Migration...');

        // 1. Idempotency Table (Source of Truth)
        await query(`
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                key TEXT PRIMARY KEY,
                response_data JSONB,
                status TEXT CHECK (status IN ('processing', 'completed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_keys(created_at)`);

        // 2. Chat ID Type Fix (Integer -> VARCHAR)
        const checkConsult = await query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'consultations' AND column_name = 'id'
        `);

        if (checkConsult.rows.length > 0 && checkConsult.rows[0].data_type === 'integer') {
            logger.info('Converting consultations schema to VARCHAR...');
            
            // DROP FK temporarily
            await query(`ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_consultation_id_fkey`);
            
            // Convert columns
            await query(`ALTER TABLE chat_messages ALTER COLUMN consultation_id TYPE VARCHAR(100)`);
            await query(`ALTER TABLE consultations ALTER COLUMN id TYPE VARCHAR(100)`);
            
            // RE-ADD FK (Crucial for Data Integrity)
            await query(`
                ALTER TABLE chat_messages 
                ADD CONSTRAINT chat_messages_consultation_id_fkey 
                FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
            `);
            
            logger.info('✅ Chat schema converted and FK restored.');
        }

        // 3. Wallet Hardening Index (Prevention of duplicates in logging)
        await query(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_ref ON wallet_transactions(reference_id)`);

        logger.info('✨ Senior++ Migration completed successfully.');
        return true;
    } catch (err) {
        logger.error('❌ Senior++ Migration Failed:', err);
        return false;
    }
}

module.exports = runSeniorMigration;
