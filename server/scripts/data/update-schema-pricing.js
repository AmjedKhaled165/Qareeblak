// Migration script to add courier pricing modification columns
// Run with: node update-schema-pricing.js

const pool = require('./db');

async function migrate() {
    console.log('🔧 Adding courier pricing columns to delivery_orders...');

    try {
        // Add courier_modifications column (JSONB to store original vs modified values)
        await pool.query(`
            ALTER TABLE delivery_orders 
            ADD COLUMN IF NOT EXISTS courier_modifications JSONB;
        `);
        console.log('✅ Added courier_modifications column');

        // Add flag to easily filter modified orders
        await pool.query(`
            ALTER TABLE delivery_orders 
            ADD COLUMN IF NOT EXISTS is_modified_by_courier BOOLEAN DEFAULT false;
        `);
        console.log('✅ Added is_modified_by_courier column');

        // Add timestamp for when courier modified the order
        await pool.query(`
            ALTER TABLE delivery_orders 
            ADD COLUMN IF NOT EXISTS courier_modified_at TIMESTAMP;
        `);
        console.log('✅ Added courier_modified_at column');

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await pool.end();
    }
}

migrate();
