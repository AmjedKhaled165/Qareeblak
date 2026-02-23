
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function ensureMockUser() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Checking for mock user 999...');
        const res = await client.query('SELECT id FROM users WHERE id = 999');
        if (res.rows.length === 0) {
            console.log('Mock user 999 not found. Inserting...');
            await client.query(`
                INSERT INTO users (id, name, email, password, type)
                VALUES (999, 'مستخدم جوجل', 'google@example.com', 'mock_password', 'customer')
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('Mock user inserted.');
        } else {
            console.log('Mock user 999 already exists.');
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}
ensureMockUser();
