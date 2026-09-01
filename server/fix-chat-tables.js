/**
 * Fix Chat Tables - Uses the SAME database as the running server
 * by loading server/.env (just like index.js does)
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');

// Re-use the exact same DATABASE_URL from .env
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in server/.env!');
    process.exit(1);
}

console.log('📍 Connecting to:', databaseUrl.replace(/:[^:@]+@/, ':****@'));

const isManagedCloudDb =
    databaseUrl.includes('neon.tech') ||
    databaseUrl.includes('supabase') ||
    databaseUrl.includes('postgres.database.azure.com') ||
    databaseUrl.includes('aivencloud.com') ||
    databaseUrl.includes('rds.amazonaws.com');

// Strip sslmode from URL (pg handles it via config)
const cleanUrl = databaseUrl
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');

const pool = new Pool({
    connectionString: cleanUrl,
    ssl: isManagedCloudDb ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('✅ Connected to database');

        // Step 1: Check if consultations table exists
        const tableCheck = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'consultations'
        `);
        
        if (tableCheck.rows.length > 0) {
            console.log('⚠️ consultations table already exists. Checking columns...');
            
            // Check columns
            const colCheck = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'consultations'
            `);
            const existingCols = colCheck.rows.map(r => r.column_name);
            console.log('   Existing columns:', existingCols.join(', '));

            // Add missing columns
            if (!existingCols.includes('customer_id')) {
                await client.query(`ALTER TABLE consultations ADD COLUMN customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
                console.log('   ✅ Added customer_id');
            }
            if (!existingCols.includes('provider_id')) {
                await client.query(`ALTER TABLE consultations ADD COLUMN provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE`);
                console.log('   ✅ Added provider_id');
            }
            if (!existingCols.includes('status')) {
                await client.query(`ALTER TABLE consultations ADD COLUMN status VARCHAR(50) DEFAULT 'active'`);
                console.log('   ✅ Added status');
            }
            if (!existingCols.includes('updated_at')) {
                await client.query(`ALTER TABLE consultations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
                console.log('   ✅ Added updated_at');
            }
            if (!existingCols.includes('order_id')) {
                await client.query(`ALTER TABLE consultations ADD COLUMN order_id INTEGER`);
                console.log('   ✅ Added order_id');
            }
        } else {
            console.log('🔨 Creating consultations table...');
            await client.query(`
                CREATE TABLE consultations (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
                    status VARCHAR(50) DEFAULT 'active',
                    order_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('   ✅ consultations table created');
        }

        // Step 2: Check chat_messages table
        const cmCheck = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'chat_messages'
        `);

        if (cmCheck.rows.length > 0) {
            console.log('⚠️ chat_messages table already exists. Checking columns...');
            
            const cmColCheck = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'chat_messages'
            `);
            const cmCols = cmColCheck.rows.map(r => r.column_name);
            console.log('   Existing columns:', cmCols.join(', '));

            // Add missing columns safely
            const neededCols = [
                { name: 'sender_id', def: 'INTEGER REFERENCES users(id) ON DELETE CASCADE' },
                { name: 'sender_type', def: "VARCHAR(50) DEFAULT 'customer'" },
                { name: 'message', def: 'TEXT' },
                { name: 'message_type', def: "VARCHAR(50) DEFAULT 'text'" },
                { name: 'image_url', def: 'TEXT' },
                { name: 'is_read', def: 'BOOLEAN DEFAULT FALSE' },
            ];

            for (const col of neededCols) {
                if (!cmCols.includes(col.name)) {
                    await client.query(`ALTER TABLE chat_messages ADD COLUMN ${col.name} ${col.def}`);
                    console.log(`   ✅ Added ${col.name}`);
                }
            }
        } else {
            console.log('🔨 Creating chat_messages table...');
            await client.query(`
                CREATE TABLE chat_messages (
                    id SERIAL PRIMARY KEY,
                    consultation_id INTEGER REFERENCES consultations(id) ON DELETE CASCADE,
                    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    sender_type VARCHAR(50) DEFAULT 'customer',
                    message TEXT,
                    message_type VARCHAR(50) DEFAULT 'text',
                    image_url TEXT,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('   ✅ chat_messages table created');
        }

        // Step 3: Create indexes for chat performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_consultations_customer_provider ON consultations(customer_id, provider_id, status)`).catch(() => {});
        await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation ON chat_messages(consultation_id, created_at DESC)`).catch(() => {});
        console.log('   ✅ Indexes created');

        // Step 4: Verify with a test query
        const verifyConsult = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'consultations' ORDER BY ordinal_position`);
        console.log('\n📋 Final consultations columns:', verifyConsult.rows.map(r => r.column_name).join(', '));

        const verifyCM = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages' ORDER BY ordinal_position`);
        console.log('📋 Final chat_messages columns:', verifyCM.rows.map(r => r.column_name).join(', '));

        console.log('\n🎉 Chat tables fix complete! Restart the server and try the chat again.');
    } catch (e) {
        console.error('❌ ERROR:', e.message);
        console.error('   Detail:', e.detail || 'N/A');
        console.error('   Hint:', e.hint || 'N/A');
    } finally {
        client.release();
        await pool.end();
    }
}

run();
