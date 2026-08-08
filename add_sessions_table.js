const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS courier_daily_sessions (
                id SERIAL PRIMARY KEY,
                courier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                session_date DATE NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(courier_id, session_date)
            );
            
            -- Adding index for faster lookup by date
            CREATE INDEX IF NOT EXISTS idx_courier_daily_sessions_date ON courier_daily_sessions(session_date);
            CREATE INDEX IF NOT EXISTS idx_courier_daily_sessions_courier ON courier_daily_sessions(courier_id);
        `);
        console.log("Table courier_daily_sessions created successfully");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}
run();
