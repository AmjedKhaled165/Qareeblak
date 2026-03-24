
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function fixSchema() {
    try {
        const client = await pool.connect();
        console.log('Checking USERS table schema...');

        // Check for role column
        const checkRole = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users' AND column_name='role'
        `);
        if (checkRole.rows.length === 0) {
            await client.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'customer'");
            console.log('Added role column.');
        }

        // Check for user_type column
        const checkType = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users' AND column_name='user_type'
        `);
        if (checkType.rows.length === 0) {
            await client.query("ALTER TABLE users ADD COLUMN user_type VARCHAR(50) DEFAULT 'customer'");
            console.log('Added user_type column.');
        }

        // Check for is_available column
        const checkAvail = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users' AND column_name='is_available'
        `);
        if (checkAvail.rows.length === 0) {
            await client.query("ALTER TABLE users ADD COLUMN is_available BOOLEAN DEFAULT true");
            console.log('Added is_available column.');
        }

        console.log('Schema update complete!');
        client.release();
    } catch (err) {
        console.error('Error fixing schema:', err);
    } finally {
        await pool.end();
    }
}

fixSchema();
