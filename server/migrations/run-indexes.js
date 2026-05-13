const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://qareeblak_owner:npg_u24mYOGCwNjR@ep-purple-tooth-agcvtnrx.c-2.eu-central-1.aws.neon.tech/qareeblak?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// Each CONCURRENTLY index must run in its own connection (cannot be inside a transaction block)
const indexes = [
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_status_user_date ON bookings(status, user_id, booking_date DESC)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_provider_category ON services(provider_id, has_offer, created_at DESC)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread_recent ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_provider_status_date ON bookings(provider_id, status, booking_date DESC)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_consultation_unread ON chat_messages(consultation_id, is_read, created_at DESC)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_category_approved ON providers(category, is_approved, rating DESC) WHERE is_approved = TRUE',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_provider_recent ON reviews(provider_id, rating, created_at DESC)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_type_active ON users(user_type, is_banned) WHERE is_banned = FALSE',
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_courier_available ON users(user_type, is_available, is_online) WHERE user_type = 'partner_courier' AND is_banned = FALSE",
];

async function run() {
    for (const sql of indexes) {
        const name = sql.match(/idx_\w+/)?.[0] || 'unknown';
        const client = await pool.connect();
        try {
            await client.query(sql);
            console.log('OK:', name);
        } catch (e) {
            console.log('SKIP:', name, '-', e.message.split('\n')[0]);
        } finally {
            client.release();
        }
    }
    await pool.end();
    console.log('All indexes done.');
}

run();
