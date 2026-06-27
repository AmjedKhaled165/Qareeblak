require('dotenv').config();
const db = require('./db');

async function run() {
    try {
        console.log('Creating outbox index...');
        await db.query(`CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'pending'`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_outbox_polling ON outbox_events(status, next_run_at) WHERE status = 'pending'`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_outbox_cleanup ON outbox_events(processed_at) WHERE status = 'processed'`);
        console.log('Indexes created!');
    } catch (e) {
        console.error('Error', e);
    } finally {
        process.exit();
    }
}

run();