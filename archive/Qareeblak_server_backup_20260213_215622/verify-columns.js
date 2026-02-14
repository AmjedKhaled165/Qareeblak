// Verify bookings table structure
const db = require('./db');

async function verifyColumns() {
    try {
        console.log('🔍 Checking bookings table columns...\n');
        
        const result = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'bookings'
            ORDER BY ordinal_position
        `);
        
        console.log('Current columns in bookings table:');
        console.log('====================================\n');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name.padEnd(25)} | ${row.data_type}`);
        });
        
        const columnNames = result.rows.map(r => r.column_name);
        const requiredColumns = ['appointment_date', 'appointment_type', 'items', 'halan_order_id', 'parent_order_id'];
        const missing = requiredColumns.filter(col => !columnNames.includes(col));
        
        console.log('\n====================================');
        if (missing.length > 0) {
            console.log('⚠️  Missing columns:', missing.join(', '));
            console.log('\n❌ Migration needed!');
        } else {
            console.log('✅ All required columns exist!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyColumns();
