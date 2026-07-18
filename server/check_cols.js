require('dotenv').config({ path: '.env.production' });
const pool = require('./db');

async function run() {
    try {
        const r = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
        );
        console.log('users columns:', r.rows.map(x => x.column_name).join(', '));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
