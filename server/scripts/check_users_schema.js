
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
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

run();
