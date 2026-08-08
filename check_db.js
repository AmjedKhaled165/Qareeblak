require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        // 1. Check if columns exist
        const colCheck = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users' AND column_name IN ('cash_number', 'instapay_account')
        `);
        console.log('Existing columns:', colCheck.rows.map(r => r.column_name));

        // 2. Add columns if missing
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS cash_number VARCHAR(100)');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS instapay_account VARCHAR(100)');
        console.log('Columns ensured.');

        // 3. Re-check
        const colCheck2 = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users' AND column_name IN ('cash_number', 'instapay_account')
        `);
        console.log('Columns after migration:', colCheck2.rows.map(r => r.column_name));

        // 4. Test: check user 'adam'
        const testUser = await pool.query(`SELECT id, name, username, cash_number, instapay_account FROM users WHERE LOWER(username)='adam'`);
        console.log('Adam user data:', testUser.rows);

    } catch(e) {
        console.error('ERROR:', e.message);
    } finally {
        await pool.end();
    }
}

run();
