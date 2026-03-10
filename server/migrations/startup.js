const db = require('../db');
const logger = require('../utils/logger');

/**
 * Run idempotent startup migrations
 */
async function runStartupMigrations() {
    logger.info('🚀 Starting database migrations...');

    try {
        // 1. Migration: Ensure default ratings are 0.0 for providers with no reviews
        const ratingRes = await db.query("UPDATE providers SET rating = 0.0 WHERE reviews_count = 0");
        if (ratingRes.rowCount > 0) {
            logger.info(`✅ Rating Migration: Updated ${ratingRes.rowCount} providers to 0.0 rating`);
        }

        // 2. Migration: Safe column and index checks for bookings
        const colCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'appointment_date'
        `);

        if (colCheck.rows.length === 0) {
            logger.info('🔄 Attempting to add appointment columns...');
            await db.query(`
                ALTER TABLE bookings 
                ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)
            `);
            logger.info(`✅ Bookings Migration: Added appointment columns`);
        }

        // 3. Check for appointment index
        const indexCheck = await db.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'bookings' AND indexname = 'idx_bookings_appointment_date'
        `);

        if (indexCheck.rows.length === 0) {
            logger.info('🔄 Attempting to create appointment index...');
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date 
                ON bookings(appointment_date)
            `);
            logger.info(`✅ Index Migration: Created appointment_date index`);
        }

        // 4. Migration: Add order_type column to delivery_orders
        await db.query("ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'manual'");
        const orderRes = await db.query(`
            UPDATE delivery_orders 
            SET order_type = 'app' 
            WHERE source ILIKE '%qareeblak%' 
            AND (order_type IS NULL OR order_type = 'manual')
        `);
        if (orderRes.rowCount > 0) {
            logger.info(`✅ Order Type Migration: Backfilled ${orderRes.rowCount} app orders`);
        }

        // 5. Migration: Add is_online and max_active_orders columns for courier capacity
        await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false");
        await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS max_active_orders INTEGER DEFAULT 10");

        // 6. Migration: Wheel of Luck Tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS wheel_prizes (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                prize_type VARCHAR(50) NOT NULL,
                prize_value DECIMAL(10, 2),
                provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
                probability INTEGER NOT NULL DEFAULT 10,
                color VARCHAR(20) DEFAULT '#f44336',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_prizes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                prize_id INTEGER REFERENCES wheel_prizes(id) ON DELETE CASCADE,
                is_used BOOLEAN DEFAULT FALSE,
                won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMP,
                booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 7. Migration: Add discount columns to orders
        await db.query("ALTER TABLE parent_orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0");
        await db.query("ALTER TABLE parent_orders ADD COLUMN IF NOT EXISTS prize_id INTEGER REFERENCES user_prizes(id)");
        await db.query("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0");

        // 8. Migration: Add Critical Performance Indexes for Halan Orders & Tracking
        logger.info('🔄 Attempting to create critical tracking indexes...');
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_delivery_customer_phone ON delivery_orders(customer_phone);
            CREATE INDEX IF NOT EXISTS idx_delivery_customer_id ON delivery_orders(customer_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_halan_order ON bookings(halan_order_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_parent_order ON bookings(parent_order_id);
            CREATE INDEX IF NOT EXISTS idx_parent_orders_user_date ON parent_orders(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation ON chat_messages(consultation_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
            CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
            CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON reviews(provider_id, review_date DESC);
        `);
        // 9. Migration: Password Reset Tokens
        await db.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        logger.info(`✅ Auth Migration: Enabled Password Reset system`);

        // 10. Migration: Wallet System (Retention & Fintech)
        await db.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                balance DECIMAL(15, 2) DEFAULT 0.00,
                currency VARCHAR(10) DEFAULT 'EGP',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id SERIAL PRIMARY KEY,
                wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
                amount DECIMAL(15, 2) NOT NULL,
                type VARCHAR(20) NOT NULL, -- 'credit', 'debit'
                purpose VARCHAR(50), -- 'order_payment', 'refund', 'referral_bonus'
                reference_id VARCHAR(100), -- order_id or other ref
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 11. Migration: Promo Code Engine
        await db.query(`
            CREATE TABLE IF NOT EXISTS promo_codes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed'
                discount_value DECIMAL(10, 2) NOT NULL,
                min_order_value DECIMAL(10, 2) DEFAULT 0,
                max_discount DECIMAL(10, 2),
                usage_limit INTEGER DEFAULT NULL,
                usage_count INTEGER DEFAULT 0,
                expires_at TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        logger.info(`✅ BI Migration: Wallets and Promo Engine initialized`);

        logger.info('✨ All migrations completed successfully');
    } catch (err) {
        // Log error but don't crash - if columns already exist or permission issues, we might be fine
        if (err.message.includes('permission denied') || err.message.includes('must be owner')) {
            console.warn('⚠️ Migration Warning: Insufficient permissions to modify schema. If columns already exist, this can be ignored.');
        } else {
            logger.error('❌ Migration Error:', err.message);
        }
    }
}

module.exports = runStartupMigrations;
