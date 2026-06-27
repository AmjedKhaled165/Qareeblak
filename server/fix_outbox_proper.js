require('dotenv').config();
const db = require('./db');

async function run() {
    try {
        console.log('Creating outbox_events...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS outbox_events (
                id BIGSERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                payload JSONB NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                last_error TEXT,
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('outbox_events Table created!');
        
        console.log('Creating idempotency_keys...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                key TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                request_hash TEXT NOT NULL,
                response_data JSONB,
                status VARCHAR(20) DEFAULT 'processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (key, user_id)
            )
        `);
        console.log('idempotency_keys Table created!');
    } catch (e) {
        console.error('Error', e);
    } finally {
        process.exit();
    }
}

run();
