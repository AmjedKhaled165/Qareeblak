
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function checkSchema() {
    try {
        const client = await pool.connect();

        console.log('--- USERS Table Columns ---');
        const usersCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        usersCols.rows.forEach(row => {
            console.log(`${row.column_name} (${row.data_type})`);
        });

        console.log('\n--- DELIVERY_ORDERS Table Columns ---');
        const ordersCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'delivery_orders';
        `);
        ordersCols.rows.forEach(row => {
            console.log(`${row.column_name} (${row.data_type})`);
        });

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
