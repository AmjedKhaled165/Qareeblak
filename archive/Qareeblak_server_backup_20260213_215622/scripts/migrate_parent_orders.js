
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function migrateParentOrder() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        // 1. Create parent_orders table
        console.log('Creating parent_orders table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS parent_orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending',
                details TEXT,
                address_info JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Add parent_order_id to bookings
        console.log('Adding parent_order_id to bookings...');
        const checkCol = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='bookings' AND column_name='parent_order_id'
        `);

        if (checkCol.rows.length === 0) {
            await client.query(`
                ALTER TABLE bookings 
                ADD COLUMN parent_order_id INTEGER REFERENCES parent_orders(id) ON DELETE SET NULL;
            `);
            console.log('Column added.');
        } else {
            console.log('Column parent_order_id already exists.');
        }

        console.log('Migration complete!');
        client.release();
    } catch (err) {
        console.error('Error during migration:', err);
    } finally {
        await pool.end();
    }
}

migrateParentOrder();
