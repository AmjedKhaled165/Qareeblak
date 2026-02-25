const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://app_user:halan2026@localhost:5432/qareeblak'
});

async function checkColumns() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'bookings'
            ORDER BY ordinal_position
        `);
        
        console.log('\n📋 Bookings Table Columns:');
        console.log('────────────────────────────────');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name} (${row.data_type})`);
        });
        console.log('────────────────────────────────');
        
        const hasAppointmentDate = result.rows.some(r => r.column_name === 'appointment_date');
        const hasAppointmentType = result.rows.some(r => r.column_name === 'appointment_type');
        
        console.log('\n✅ Column Check:');
        console.log(`  appointment_date: ${hasAppointmentDate ? '✓ EXISTS' : '✗ MISSING'}`);
        console.log(`  appointment_type: ${hasAppointmentType ? '✓ EXISTS' : '✗ MISSING'}\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkColumns();
