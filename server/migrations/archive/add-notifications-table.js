/**
 * Migration: Create Notifications Table & Add appointment columns to bookings
 * Run: node server/add-notifications-table.js
 */
const db = require('./db');

async function migrate() {
    try {
        console.log('🔧 Running notifications & appointment migration...');

        // 1. Create notifications table
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                reference_id VARCHAR(100),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ notifications table created');

        // 2. Create index on user_id for fast lookups
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
        `);
        console.log('✅ notifications indexes created');

        // 3. Add appointment_date column to bookings (if not exists)
        await db.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'bookings' AND column_name = 'appointment_date'
                ) THEN
                    ALTER TABLE bookings ADD COLUMN appointment_date TIMESTAMP;
                END IF;
            END $$;
        `);
        console.log('✅ appointment_date column added to bookings');

        // 4. Add appointment_type column to bookings (if not exists)
        await db.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'bookings' AND column_name = 'appointment_type'
                ) THEN
                    ALTER TABLE bookings ADD COLUMN appointment_type VARCHAR(50) DEFAULT 'immediate';
                END IF;
            END $$;
        `);
        console.log('✅ appointment_type column added to bookings');

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
