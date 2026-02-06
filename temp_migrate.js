const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const db = require('./server/db');

async function migrate() {
    try {
        console.log('Starting migration...');
        
        // Add items column (JSONB)
        await db.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS items JSONB');
        console.log('Added items column');
        
        // Add halan_order_id column (INTEGER)
        await db.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS halan_order_id INTEGER');
        console.log('Added halan_order_id column');
        
        // Add updated_at column for calculating the 5-minute window
        await db.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        console.log('Added updated_at column');

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
