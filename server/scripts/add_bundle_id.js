
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function addBundleIdColumn() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Connected!');

        // Check if column exists
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='bookings' AND column_name='bundle_id';
        `);

        if (checkRes.rows.length === 0) {
            console.log('Adding bundle_id column to bookings table...');
            await client.query(`ALTER TABLE bookings ADD COLUMN bundle_id VARCHAR(50);`);
            console.log('Column added successfully!');
        } else {
            console.log('Column bundle_id already exists.');
        }

        client.release();
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        await pool.end();
    }
}

addBundleIdColumn();
