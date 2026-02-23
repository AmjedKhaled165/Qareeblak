
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function debugOrder(parentId) {
    try {
        const client = await pool.connect();

        console.log(`\n--- DEBUGGING PARENT ORDER P${parentId} ---`);
        const parent = await client.query('SELECT * FROM parent_orders WHERE id = $1', [parentId]);
        if (parent.rows.length === 0) {
            console.log('Parent order NOT FOUND.');
        } else {
            console.log(`Parent Status: ${parent.rows[0].status}`);
        }

        console.log('\n--- SUB-ORDERS (BOOKINGS) ---');
        const bookings = await client.query(`
            SELECT b.id, b.provider_name, b.status, b.halan_order_id, d.status as halan_status 
            FROM bookings b
            LEFT JOIN delivery_orders d ON b.halan_order_id = d.id
            WHERE b.parent_order_id = $1
        `, [parentId]);

        bookings.rows.forEach(b => {
            console.log(`Booking #${b.id} (${b.provider_name}): Status=${b.status}, HalanStatus=${b.halan_status}`);
        });

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

// Try ID 1 as seen in the image
debugOrder(1);
