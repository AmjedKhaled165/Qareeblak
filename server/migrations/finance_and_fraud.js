const db = require('../db');
const logger = require('../utils/logger');

async function runFinanceAndFraudMigrations() {
    logger.info('💸 Starting Financial & Anti-Fraud migrations...');
    const query = (text, params) => db.query(text, params);

    try {
        // Ensure required DB extensions exist before any schema/table operations.
        await query('CREATE EXTENSION IF NOT EXISTS postgis;');
        await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        await query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

        // 1. Add Commission to Providers
        await query(`
            ALTER TABLE providers 
            ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 10.00
        `);

        // 2. Add Financial details to Bookings
        await query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS net_provider_amount DECIMAL(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_paid_to_provider BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS payout_id INTEGER
        `);

        // 3. Create Payouts Table
        await query(`
            CREATE TABLE IF NOT EXISTS payouts (
                id SERIAL PRIMARY KEY,
                provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
                amount DECIMAL(15, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
                payout_method VARCHAR(50), -- cash, bank_transfer, vodafone_cash
                reference_number VARCHAR(100),
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Anti-Fraud: Track user cancellation behavior
        await query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS cancellation_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_cancellation_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100
        `);

        logger.info('✅ Financial & Anti-Fraud migrations completed');
    } catch (err) {
        console.dir(err, { depth: null });
        console.error('Finance/Fraud Migration Error JSON:', JSON.stringify({
            message: err?.message,
            code: err?.code,
            detail: err?.detail,
            hint: err?.hint,
            where: err?.where,
            schema: err?.schema,
            table: err?.table,
            column: err?.column,
            constraint: err?.constraint,
            routine: err?.routine,
        }, null, 2));
        logger.error('❌ Finance/Fraud Migration Error:', err.stack || err.message || err);
    }
}

module.exports = runFinanceAndFraudMigrations;
