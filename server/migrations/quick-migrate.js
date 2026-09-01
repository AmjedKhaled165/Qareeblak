/**
 * Quick Database Migration Runner
 * Simplified version to test database connection and run indexes
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { MongoClient } = require('mongodb');

console.log('🔍 Testing database connection...');

async function quickMigration() {
    try {
        // Test connection
        const testResult = await db.query('SELECT NOW() as current_time');
        console.log('✅ Database connected! Current time:', testResult.rows[0].current_time);

        // Check if bookings table exists
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('bookings', 'providers', 'users')
        `);
        console.log('📋 Found tables:', tablesResult.rows.map(r => r.table_name).join(', '));

        // Create indexes (non-concurrent for speed in dev)
        console.log('\n📊 Creating indexes...');

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id)',
            'CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)',
            'CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date DESC)',
            'CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category)',
            'CREATE INDEX IF NOT EXISTS idx_providers_is_approved ON providers(is_approved)',
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        ];

        for (const sql of indexes) {
            try {
                const indexName = sql.match(/idx_\w+/)[0];
                await db.query(sql);
                console.log(`  ✅ ${indexName}`);
            } catch (err) {
                console.log(`  ⚠️  ${sql.match(/idx_\w+/)[0]}: ${err.message}`);
            }
        }

        console.log('\n✨ Migration completed!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

quickMigration();
