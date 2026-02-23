const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'qareeblak',
    password: process.env.DB_PASSWORD || 'password123',
    port: process.env.DB_PORT || 5432,
});

async function updateSchema() {
    try {
        console.log('🔄 Updating database schema...');

        // Add service_id to bookings
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'service_id') THEN 
                    ALTER TABLE bookings ADD COLUMN service_id INTEGER REFERENCES services(id) ON DELETE SET NULL; 
                    RAISE NOTICE 'Added service_id column';
                END IF; 
            END $$;
        `);

        // Add price to bookings
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'price') THEN 
                    ALTER TABLE bookings ADD COLUMN price DECIMAL(10,2); 
                    RAISE NOTICE 'Added price column';
                END IF; 
            END $$;
        `);

        console.log('✅ Database schema updated successfully!');
    } catch (error) {
        console.error('❌ Error updating schema:', error);
    } finally {
        await pool.end();
    }
}

updateSchema();
