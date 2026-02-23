
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
        const res = await client.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);
        console.log(res.rows.map(r => r.column_name).join(', '));
    } catch (err) {
        console.error(err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
