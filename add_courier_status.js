require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_status VARCHAR(50) DEFAULT 'متاح'`);
        console.log("Column added successfully");
    } catch(e) {
        console.log(e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
migrate();
