
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function checkRecent() {
    try {
        const res = await pool.query('SELECT id, provider_name, created_at, bundle_id FROM bookings WHERE id IN (3, 4)');
        console.log(JSON.stringify(res.rows, null, 2));
        pool.end();
    } catch (e) {
        console.error(e);
    }
}

checkRecent();
