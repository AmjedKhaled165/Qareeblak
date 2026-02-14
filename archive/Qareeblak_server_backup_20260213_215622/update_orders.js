const pool = require('./db');

async function updateOrdersToQareeblak() {
    try {
        console.log('🔄 Updating recent orders to source = qareeblak...');

        // Update the last 5 orders to be from 'qareeblak'
        const result = await pool.query(`
            UPDATE delivery_orders 
            SET source = 'qareeblak', supervisor_id = NULL
            WHERE id IN (
                SELECT id FROM delivery_orders 
                ORDER BY created_at DESC 
                LIMIT 5
            )
        `);

        console.log(`✅ Updated ${result.rowCount} orders to 'qareeblak'.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

updateOrdersToQareeblak();
