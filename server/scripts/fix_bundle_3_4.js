
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function fixOrders() {
    try {
        const bundleId = `BUNDLE-FIX-3-4-${Date.now()}`;
        console.log(`Assigning Bundle ID: ${bundleId} to orders 3 and 4`);
        await pool.query('UPDATE bookings SET bundle_id = $1 WHERE id IN (3, 4)', [bundleId]);
        console.log('Update successful!');
        pool.end();
    } catch (e) {
        console.error(e);
    }
}

fixOrders();
