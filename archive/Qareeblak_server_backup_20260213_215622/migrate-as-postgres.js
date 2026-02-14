// Add appointment columns using postgres superuser
const { Pool } = require('pg');
const path = require('path');

// Load environment from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Get current DATABASE_URL and modify user to postgres
const originalUrl = process.env.DATABASE_URL;
let postgresUrl;

if (originalUrl && originalUrl.includes('@')) {
    // Replace app_user with postgres
    postgresUrl = originalUrl.replace(/^postgresql:\/\/[^:]+:/, 'postgresql://postgres:');
    console.log('🔐 Using postgres superuser for migration\n');
} else {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString: postgresUrl
});

async function addAppointmentColumns() {
    console.log('🔄 Adding appointment columns to bookings table...\n');
    
    try {
        // Add appointment_date
        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP
        `);
        console.log('✓ Added appointment_date column');

        // Add appointment_type  
        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)
        `);
        console.log('✓ Added appointment_type column');

        // Create index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date 
            ON bookings(appointment_date)
        `);
        console.log('✓ Created index on appointment_date');

        console.log('\n✅ Migration completed successfully!');
        console.log('   Restart the server to apply changes.\n');
        
        await pool.end();
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await pool.end();
        setTimeout(() => process.exit(1), 1000);
    }
}

addAppointmentColumns();
