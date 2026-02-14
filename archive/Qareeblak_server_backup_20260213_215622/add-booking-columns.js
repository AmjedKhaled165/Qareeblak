// Quick migration using existing db connection
const db = require('./db');

async function addMissingColumns() {
    try {
        console.log('🔄 Adding missing columns to bookings table...\n');

        // Add appointment_date column
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP
        `);
        console.log('✓ Added appointment_date');

        // Add appointment_type column  
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)
        `);
        console.log('✓ Added appointment_type');

        // Add items column
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS items TEXT
        `);
        console.log('✓ Added items');

        // Add halan_order_id column
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS halan_order_id INTEGER
        `);
        console.log('✓ Added halan_order_id');

        // Add parent_order_id column
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS parent_order_id INTEGER
        `);
        console.log('✓ Added parent_order_id');

        // Create indexes
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_halan_order ON bookings(halan_order_id)
        `);
        console.log('✓ Created index on halan_order_id');

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date)
        `);
        console.log('✓ Created index on appointment_date');

        console.log('\n✅ Migration completed successfully!');
        console.log('   You can now restart the server.\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

addMissingColumns();
