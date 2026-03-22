require('dotenv').config({ path: 'c:\\Users\\Eng.Amjed\\Desktop\\Qareeblak\\.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'parent_orders'
        `);
        console.log("Columns:", res.rows.map(r => r.column_name));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
main();
