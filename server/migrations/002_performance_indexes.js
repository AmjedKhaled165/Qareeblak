const db = require('../db');
const logger = require('../utils/logger');

async function runPerformanceIndexesMigration() {
    logger.info('🚀 Starting performance indexes migration...');
    const query = (text, params) => db.query(text, params);

    try {
        // We use CREATE INDEX IF NOT EXISTS, which is safe to run multiple times.
        // For performance, we ideally want CONCURRENTLY, but CONCURRENTLY cannot be used inside a transaction block.
        // We will execute them sequentially without a transaction block.

        const indexes = [
            // delivery_orders table
            'CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);',
            'CREATE INDEX IF NOT EXISTS idx_delivery_orders_courier_id ON delivery_orders(courier_id);',
            'CREATE INDEX IF NOT EXISTS idx_delivery_orders_supervisor_id ON delivery_orders(supervisor_id);',
            'CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at ON delivery_orders(created_at DESC);',
            
            // bookings table
            // The most critical index: functional index on CAST(halan_order_id AS TEXT) to match queries
            'CREATE INDEX IF NOT EXISTS idx_bookings_halan_order_text ON bookings(CAST(halan_order_id AS TEXT));',
            'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);',
            
            // order_history table
            'CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);',
            
            // users table
            'CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);',
            
            // courier_supervisors table
            'CREATE INDEX IF NOT EXISTS idx_courier_supervisors_supervisor_id ON courier_supervisors(supervisor_id);',
            'CREATE INDEX IF NOT EXISTS idx_courier_supervisors_courier_id ON courier_supervisors(courier_id);'
        ];

        for (const sql of indexes) {
            try {
                await query(sql);
                logger.info(`✅ Executed: ${sql.split(' ON ')[0]}`);
            } catch (err) {
                logger.warn(`⚠️ Failed to create index: ${sql.split(' ON ')[0]} - ${err.message}`);
            }
        }

        logger.info('✨ Performance indexes migration completed successfully');
        return true;
    } catch (err) {
        logger.error('❌ Performance indexes migration error:', err.stack || err.message || err);
        return false;
    }
}

module.exports = runPerformanceIndexesMigration;
