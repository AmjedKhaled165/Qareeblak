// Check bookings table structure
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkTableStructure() {
    try {
        console.log('🔍 Checking bookings table structure...\n');
        
        const result = await pool.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'bookings'
            ORDER BY ordinal_position;
        `);
        
        console.log('📊 Current columns in bookings table:');
        console.log('=====================================\n');
        
        result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | Nullable: ${col.is_nullable}`);
        });
        
        console.log('\n=====================================');
        console.log(`Total columns: ${result.rows.length}`);
        
        // Check for missing columns
        const expectedColumns = [
            'appointment_date',
            'appointment_type',
            'items',
            'halan_order_id',
            'parent_order_id'
        ];
        
        const existingColumns = result.rows.map(row => row.column_name);
        const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length > 0) {
            console.log('\n⚠️  Missing columns:');
            missingColumns.forEach(col => console.log(`   - ${col}`));
            console.log('\n💡 Run the migration script to add these columns.');
        } else {
            console.log('\n✅ All expected columns exist!');
        }
        
        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkTableStructure();
