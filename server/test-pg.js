require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    try {
        console.log("Checking DB...");
        // 1. check schema of parent_orders
        const res = await pool.query(`
            SELECT table_schema, column_name 
            FROM information_schema.columns 
            WHERE table_name IN ('parent_orders', 'bookings', 'delivery_orders')
        `);
        console.log("Found columns:", res.rows.length);
        const map = {};
        for (const row of res.rows) {
            const t = row.table_schema + '.' + row.column_name;
            map[row.table_schema] = map[row.table_schema] || [];
            map[row.table_schema].push(row.column_name);
        }
        console.log("Schema Map:", map);

        // 2. Just query the actual fields
        for (const table of ['parent_orders', 'bookings', 'delivery_orders']) {
            try {
                const head = await pool.query(`SELECT * FROM ${table} LIMIT 1`);
                console.log(`Table ${table} cols:`, head.fields.map(f => f.name));
            } catch (e) {
                console.log(`Query ${table} failed:`, e.message);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
main();
