// Add source column to delivery_orders table
const pool = require('./db');

async function addSourceColumn() {
    try {
        console.log('🔧 Adding source column to delivery_orders table...');

        await pool.query(`
            ALTER TABLE delivery_orders 
            ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'
        `);

        console.log('✅ Column added successfully!');

        // Update existing orders to have 'manual' as default
        const result = await pool.query(`
            UPDATE delivery_orders 
            SET source = 'manual' 
            WHERE source IS NULL
        `);

        console.log(`📝 Updated ${result.rowCount} existing orders with default source.`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

addSourceColumn();
