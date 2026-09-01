
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

        // Let's try to insert without ID first to see if it works
        const res = await client.query(`
            INSERT INTO users (name, email, password, type)
            VALUES ('Test User', 'test@test.com', 'pass', 'customer')
            RETURNING id
        `);
        console.log('Inserted with ID:', res.rows[0].id);

        // Now try to update it to 999
        await client.query('UPDATE users SET id = 999 WHERE id = $1', [res.rows[0].id]);
        console.log('Updated to 999');

    } catch (err) {
        console.error('ERROR_CODE:', err.code);
        console.error('ERROR_MSG:', err.message);
        console.error('ERROR_DETAIL:', err.detail);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
