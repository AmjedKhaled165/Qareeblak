const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');

const migrate = async () => {
    try {
        console.log('Adding items column to delivery_orders...');
        await pool.query('ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS items JSONB;');
        console.log('Successfully added items column.');
        process.exit(0);
    } catch (err) {
        console.error('Error adding column:', err);
        process.exit(1);
    }
};

migrate();
