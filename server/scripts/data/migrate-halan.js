// Halan Schema Migration Script
// Run with: node migrate-halan.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function migrate() {
    console.log('🔧 Starting Halan schema migration...\n');

    try {
        // Add new columns to users table
        console.log('📝 Adding new columns to users table...');

        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE
        `).catch(() => console.log('   - username column already exists'));

        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)
        `).catch(() => console.log('   - phone column already exists'));

        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false
        `).catch(() => console.log('   - is_available column already exists'));

        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES users(id)
        `).catch(() => console.log('   - supervisor_id column already exists'));

        console.log('✅ Users table updated\n');

        // Create delivery_orders table
        console.log('📝 Creating delivery_orders table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_orders (
                id SERIAL PRIMARY KEY,
                order_number VARCHAR(50) UNIQUE NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_phone VARCHAR(50) NOT NULL,
                pickup_address TEXT NOT NULL,
                delivery_address TEXT NOT NULL,
                pickup_lat DECIMAL(10, 8),
                pickup_lng DECIMAL(11, 8),
                delivery_lat DECIMAL(10, 8),
                delivery_lng DECIMAL(11, 8),
                courier_id INTEGER REFERENCES users(id),
                supervisor_id INTEGER REFERENCES users(id),
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT,
                estimated_delivery TIMESTAMP,
                actual_delivery TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ delivery_orders table created\n');

        // Create order_history table
        console.log('📝 Creating order_history table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS order_history (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES delivery_orders(id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL,
                changed_by INTEGER REFERENCES users(id),
                notes TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ order_history table created\n');

        // Create indexes
        console.log('📝 Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_delivery_orders_courier ON delivery_orders(courier_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type)');
        console.log('✅ Indexes created\n');

        console.log('✨ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await pool.end();
    }
}

migrate();
