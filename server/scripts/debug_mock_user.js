
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
        console.log('Connecting...');
        client = await pool.connect();
        console.log('Connected.');

        // Verify database name
        const dbName = await client.query('SELECT current_database()');
        console.log('Current Database:', dbName.rows[0].current_database);

        console.log('Attempting to find user 999...');
        // Try to query with quotes just in case
        const findRes = await client.query('SELECT * FROM "users" WHERE id = 999');

        if (findRes.rows.length === 0) {
            console.log('User 999 not found. Inserting...');
            await client.query(`
                INSERT INTO "users" (id, name, email, password, type)
                VALUES (999, 'مستخدم جوجل', 'google@example.com', 'mock_password', 'customer')
            `);
            console.log('Inserted user 999.');
        } else {
            console.log('User 999 already exists.');
        }

    } catch (err) {
        console.error('--- ERROR ---');
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        console.error('Stack:', err.stack);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
