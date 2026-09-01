
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'qareeblak',
    user: 'postgres',
    password: 'qareeblak123'
});

async function run() {
    let client;
    try {
        client = await pool.connect();

        console.log('Checking for user 999...');
        const res = await client.query('SELECT id FROM users WHERE id = 999');

        if (res.rows.length === 0) {
            console.log('Inserting user 999...');
            await client.query(`
                INSERT INTO users (id, name, email, password, user_type)
                VALUES (999, 'مستخدم جوجل', 'google@example.com', 'mock_password', 'customer')
            `);
            console.log('User 999 created successfully.');
        } else {
            console.log('User 999 already exists.');
        }

    } catch (err) {
        console.error('FAILED:', err.message);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
