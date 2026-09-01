const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');

const migrate = async () => {
    try {
        console.log('Adding delivery_fee column to delivery_orders...');
        // Add delivery_fee as NUMERIC (or DECIMAL) to store currency values properly
        await pool.query('ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;');
        console.log('Successfully added delivery_fee column.');
        process.exit(0);
    } catch (err) {
        console.error('Error adding column:', err);
        process.exit(1);
    }
};

migrate();
