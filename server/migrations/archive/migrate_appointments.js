const { Pool } = require('pg');

// Try to use the superuser to run the migration
const databaseUrl = "postgresql://postgres:postgres@localhost:5432/qareeblak";

const pool = new Pool({
    connectionString: databaseUrl,
});

async function migrate() {
    try {
        console.log('Starting migration with superuser...');

        // Add appointment_date column
        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP DEFAULT NULL;
        `);
        console.log('Added appointment_date column.');

        // Add appointment_type column
        await pool.query(`
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(50) DEFAULT 'immediate';
        `);
        console.log('Added appointment_type column.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
