// Migration: Add chat_messages table for pharmacy consultations
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');

async function migrate() {
    try {
        console.log('🔄 Creating chat_messages table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                consultation_id VARCHAR(100) NOT NULL,
                sender_id INTEGER REFERENCES users(id),
                sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'pharmacist')),
                message TEXT,
                image_url TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ chat_messages table created');

        // Create index for fast lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation 
            ON chat_messages(consultation_id);
        `);
        console.log('✅ Index on consultation_id created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created 
            ON chat_messages(created_at);
        `);
        console.log('✅ Index on created_at created');

        // Create consultations table to track active sessions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS consultations (
                id VARCHAR(100) PRIMARY KEY,
                customer_id INTEGER REFERENCES users(id),
                provider_id INTEGER REFERENCES providers(id),
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'converted_to_order')),
                order_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ consultations table created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_provider 
            ON consultations(provider_id);
        `);
        console.log('✅ Index on provider_id created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_customer 
            ON consultations(customer_id);
        `);
        console.log('✅ Index on customer_id created');

        console.log('');
        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
