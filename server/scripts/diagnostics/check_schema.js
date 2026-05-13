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

async function checkSchema() {
    try {
        console.log('Checking delivery_orders schema...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'delivery_orders'
            ORDER BY ordinal_position
        `);
        console.log('Columns:');
        res.rows.forEach(row => {
            console.log(` - ${row.column_name} (${row.data_type})`);
        });

        console.log('\nChecking for any orders in the table...');
        const countRes = await pool.query('SELECT COUNT(*) FROM delivery_orders');
        console.log(`Total orders: ${countRes.rows[0].count}`);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkSchema();
