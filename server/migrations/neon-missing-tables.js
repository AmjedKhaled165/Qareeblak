/**
 * Missing Tables Migration for Neon.tech
 * Creates tables not present in schema.sql or halan-schema.sql
 */
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://qareeblak_owner:npg_u24mYOGCwNjR@ep-purple-tooth-agcvtnrx.c-2.eu-central-1.aws.neon.tech/qareeblak?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        // 1. Consultations
        await client.query(`
            CREATE TABLE IF NOT EXISTS consultations (
                id SERIAL PRIMARY KEY,
                customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('OK: consultations');

        // 2. Chat Messages
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                consultation_id INTEGER REFERENCES consultations(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                sender_type VARCHAR(50) DEFAULT 'customer',
                message TEXT,
                message_type VARCHAR(50) DEFAULT 'text',
                image_url TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('OK: chat_messages');

        // 3. Parent Orders
        await client.query(`
            CREATE TABLE IF NOT EXISTS parent_orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending',
                details TEXT,
                address_info JSONB,
                discount_amount DECIMAL(10, 2) DEFAULT 0,
                prize_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('OK: parent_orders');

        // 4. Add parent_order_id to bookings if missing
        await client.query(`
            ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS parent_order_id INTEGER REFERENCES parent_orders(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS halan_order_id INTEGER,
            ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0
        `);
        console.log('OK: bookings new columns');

        // 5. Wheel tables
        await client.query(`
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
        await client.query(`
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
        console.log('OK: wheel_prizes, user_prizes');

        // 6. Password Reset Tokens
        await client.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('OK: password_reset_tokens');

        // 7. Users new columns
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS max_active_orders INTEGER DEFAULT 10`);
        console.log('OK: users.is_online, users.max_active_orders');

        // 8. Delivery orders new columns
        await client.query(`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'manual'`);
        console.log('OK: delivery_orders.order_type');

        // 9. Fix prize_id FK now that user_prizes exists
        await client.query(`ALTER TABLE parent_orders ADD COLUMN IF NOT EXISTS prize_id INTEGER REFERENCES user_prizes(id)`).catch(() => {});

        console.log('\nAll missing tables and columns applied successfully.');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
