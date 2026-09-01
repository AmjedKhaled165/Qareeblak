const { Pool } = require('pg');

const dbConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    database: 'qareeblak',
    password: 'qareeblak123',
    port: 5432,
};
const pool = new Pool(dbConfig);

async function inspect() {
    const client = await pool.connect();
    try {
        console.log('--- Columns ---');
        const cols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'delivery_orders'
        `);
        cols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        console.log('\n--- Distinct Sources ---');
        const sources = await client.query('SELECT DISTINCT source, count(*) FROM delivery_orders GROUP BY source');
        sources.rows.forEach(r => console.log(`${r.source}: ${r.count}`));

        console.log('\n--- Distinct Statuses ---');
        const statuses = await client.query('SELECT DISTINCT status, count(*) FROM delivery_orders GROUP BY status');
        statuses.rows.forEach(r => console.log(`${r.status}: ${r.count}`));

        console.log('\n--- Orders with is_deleted = true ---');
        const deleted = await client.query('SELECT count(*) FROM delivery_orders WHERE is_deleted = true');
        console.log(`Deleted count: ${deleted.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

inspect();
