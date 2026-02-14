const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkOrders() {
    try {
        console.log('Checking last 5 orders...');
        const res = await pool.query(`
            SELECT id, order_number, status, courier_id, delivery_fee, created_at, is_deleted 
            FROM delivery_orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.table(res.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkOrders();
