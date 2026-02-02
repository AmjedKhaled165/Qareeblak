const db = require('./db');

async function migrate() {
    try {
        console.log('🚀 Starting migration to fix missing columns...');

        await db.query(`
            DO $$ 
            BEGIN 
                -- Add avatar if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar') THEN
                    ALTER TABLE users ADD COLUMN avatar TEXT;
                    RAISE NOTICE 'Added column avatar to users table';
                END IF;
                
                -- Add username if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
                    ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE;
                    RAISE NOTICE 'Added column username to users table';
                END IF;

                -- Add phone if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
                    ALTER TABLE users ADD COLUMN phone VARCHAR(50);
                    RAISE NOTICE 'Added column phone to users table';
                END IF;

                -- Add latitude if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='latitude') THEN
                    ALTER TABLE users ADD COLUMN latitude DECIMAL(10, 8);
                    RAISE NOTICE 'Added column latitude to users table';
                END IF;

                -- Add longitude if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='longitude') THEN
                    ALTER TABLE users ADD COLUMN longitude DECIMAL(11, 8);
                    RAISE NOTICE 'Added column longitude to users table';
                END IF;

                -- Add last_location_update if missing
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_location_update') THEN
                    ALTER TABLE users ADD COLUMN last_location_update TIMESTAMP;
                    RAISE NOTICE 'Added column last_location_update to users table';
                END IF;
            END $$;
        `);

        console.log('✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
