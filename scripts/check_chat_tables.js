const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkTables() {
    try {
        console.log('📊 Checking Chat Tables...');
        console.log('Connection String:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));

        // Check tables
        const tablesRes = await pool.query(`
            SELECT tablename, tableowner 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('chat_messages', 'consultations');
        `);

        console.log('\nFound Tables:', tablesRes.rows);

        if (tablesRes.rows.length === 0) {
            console.error('❌ No chat tables found!');
        } else {
            for (const table of tablesRes.rows) {
                const cols = await pool.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1
                `, [table.table_name]);
                console.log(`\nColumns for ${table.table_name}:`);
                cols.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));
            }
        }

        // Try to insert a dummy consultation to test permissions
        console.log('\n📝 Testing permissions...');
        try {
            await pool.query(`
                INSERT INTO consultations (id, customer_id, provider_id, status)
                VALUES ('test-perm-check', 0, 0, 'closed')
                ON CONFLICT (id) DO NOTHING;
            `);
            console.log('✅ Write permission on consultations: OK');
            await pool.query("DELETE FROM consultations WHERE id = 'test-perm-check'");
        } catch (e) {
            console.error('❌ Write permission failed on consultations:', e.message);
        }

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
    } finally {
        pool.end();
    }
}

checkTables();
