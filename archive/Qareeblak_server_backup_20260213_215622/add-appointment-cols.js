// Add appointment columns only
const db = require('./db');

async function addAppointmentColumns() {
    console.log('🔄 Adding appointment columns to bookings table...\n');
    
    try {
        // Add appointment_date
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP
        `);
        console.log('✓ Added appointment_date column');

        // Add appointment_type  
        await db.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50)
        `);
        console.log('✓ Added appointment_type column');

        // Create index
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date 
            ON bookings(appointment_date)
        `);
        console.log('✓ Created index on appointment_date');

        console.log('\n✅ Appointment columns added successfully!');
        console.log('   Restart the server to clear the errors.\n');
        
        // Wait for console output
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        setTimeout(() => process.exit(1), 1000);
    }
}

addAppointmentColumns();
