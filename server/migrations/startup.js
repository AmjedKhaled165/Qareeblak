const db = require('../db');

/**
 * Run idempotent startup migrations
 */
async function runStartupMigrations() {
    console.log('🚀 Starting database migrations...');

    try {
        // 1. Migration: Ensure default ratings are 0.0 for providers with no reviews
        const ratingRes = await db.query("UPDATE providers SET rating = 0.0 WHERE reviews_count = 0");
        if (ratingRes.rowCount > 0) {
            console.log(`✅ Rating Migration: Updated ${ratingRes.rowCount} providers to 0.0 rating`);
        }

        // 2. Migration: Safe column and index checks for bookings
        const colCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'appointment_date'
        `);

        if (colCheck.rows.length === 0) {
            console.log('🔄 Attempting to add appointment columns...');
            await db.query(`
                ALTER TABLE bookings 
                ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP,
                ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)
            `);
            console.log(`✅ Bookings Migration: Added appointment columns`);
        }

        // 3. Check for appointment index
        const indexCheck = await db.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'bookings' AND indexname = 'idx_bookings_appointment_date'
        `);

        if (indexCheck.rows.length === 0) {
            console.log('🔄 Attempting to create appointment index...');
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date 
                ON bookings(appointment_date)
            `);
            console.log(`✅ Index Migration: Created appointment_date index`);
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
            console.log(`✅ Order Type Migration: Backfilled ${orderRes.rowCount} app orders`);
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
        console.log('🔄 Attempting to create critical tracking indexes...');
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
        console.log(`✅ Auth Migration: Enabled Password Reset system`);

        console.log('✨ All migrations completed successfully');
    } catch (err) {
        // Log error but don't crash - if columns already exist or permission issues, we might be fine
        if (err.message.includes('permission denied') || err.message.includes('must be owner')) {
            console.warn('⚠️ Migration Warning: Insufficient permissions to modify schema. If columns already exist, this can be ignored.');
        } else {
            console.error('❌ Migration Error:', err.message);
        }
    }
}

module.exports = runStartupMigrations;
