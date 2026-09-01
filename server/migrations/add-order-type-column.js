/**
 * Migration: Add `order_type` column to delivery_orders table
 * Values: 'app' (Qareeblak customer orders) | 'manual' (Admin/Courier created orders)
 * 
 * Run: node server/migrations/add-order-type-column.js
 */
const { pool } = require('../db');

async function migrate() {
    try {
        console.log('🔄 Adding order_type column to delivery_orders...');

        // Add column if not exists
        await pool.query(`
            ALTER TABLE delivery_orders 
            ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'manual'
        `);

        // Backfill existing data: Orders with source containing 'qareeblak' are app orders
        const result = await pool.query(`
            UPDATE delivery_orders 
            SET order_type = 'app' 
            WHERE source ILIKE '%qareeblak%' AND (order_type IS NULL OR order_type = 'manual')
        `);
        console.log(`✅ Backfilled ${result.rowCount} app orders.`);

        // Also add is_online column for couriers if missing
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false
        `);

        // Add max_active_orders column for courier capacity
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS max_active_orders INTEGER DEFAULT 10
        `);

        console.log('✅ Migration complete: order_type column added.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
