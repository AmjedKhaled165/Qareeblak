const db = require('./db');

/**
 * Apply performance indexes for production scale
 */
const applyIndexes = async () => {
    try {
        console.log('🏗️ Applying performance indexes...');

        await db.query(`
            -- Index on bookings foreign keys
            CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
            
            -- Index on providers for list filtering
            CREATE INDEX IF NOT EXISTS idx_providers_is_approved ON providers(is_approved);
            CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category);
            
            -- Index on services for provider lookup
            CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
            
            -- User email index (should be unique, but adding if not present)
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);

        console.log('✅ All indexes applied successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to apply indexes:', error);
        process.exit(1);
    }
};

applyIndexes();
