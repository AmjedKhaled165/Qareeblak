// Run database migration to add missing columns
const { Pool } = require('pg');
const { readFile } = require('node:fs/promises');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    try {
        console.log('🔄 Running database migration...\n');
        console.log('📊 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'Unknown');
        
        const migrationPath = path.join(__dirname, 'migrations', '001_add_booking_columns.sql');
        const sql = await readFile(migrationPath, 'utf8');
        
        console.log('📝 Executing migration SQL...\n');
        await pool.query(sql);
        
        console.log('✅ Migration completed successfully!\n');
        
        // Verify columns were added
        const result = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'bookings'
            AND column_name IN ('appointment_date', 'appointment_type', 'items', 'halan_order_id', 'parent_order_id')
            ORDER BY column_name;
        `);
        
        console.log('📋 Verified new columns:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.column_name}`);
        });
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nStack trace:', error.stack);
        await pool.end();
        process.exit(1);
    }
}

runMigration();
