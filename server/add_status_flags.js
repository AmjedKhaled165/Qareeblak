const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');

const migrate = async () => {
    try {
        console.log('Adding is_deleted and is_edited columns to delivery_orders...');
        await pool.query('ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;');
        await pool.query('ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;');
        console.log('Successfully added status flags.');
        process.exit(0);
    } catch (err) {
        console.error('Error adding columns:', err);
        process.exit(1);
    }
};

migrate();
