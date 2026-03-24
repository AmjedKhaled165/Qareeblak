require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    try {
        console.log("Adding missing columns to parent_orders...");
        await pool.query(`ALTER TABLE parent_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`);
        await pool.query(`ALTER TABLE parent_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log("Columns added successfully!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
main();
