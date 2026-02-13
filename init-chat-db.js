#!/usr/bin/env node

/**
 * Database Initialization Utility for Chat System
 * 
 * Usage: 
 *   node init-chat-db.js
 * 
 * This script ensures all chat tables and indexes are created properly
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(type, message) {
    const prefix = {
        'i': `${COLORS.blue}[INFO]${COLORS.reset}`,
        's': `${COLORS.green}[✓]${COLORS.reset}`,
        'e': `${COLORS.red}[ERROR]${COLORS.reset}`,
        'w': `${COLORS.yellow}[WARN]${COLORS.reset}`
    }[type] || type;
    console.log(`${prefix} ${message}`);
}

async function createTables() {
    try {
        log('i', 'Creating chat tables...');

        // Create consultations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS consultations (
                id VARCHAR(100) PRIMARY KEY,
                customer_id INTEGER NOT NULL,
                provider_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active' 
                    CHECK (status IN ('active', 'closed', 'converted_to_order')),
                order_id INTEGER,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        log('s', 'Consultations table created/verified');

        // Create chat_messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                consultation_id VARCHAR(100) NOT NULL,
                sender_id INTEGER NOT NULL,
                sender_type VARCHAR(20) NOT NULL DEFAULT 'customer'
                    CHECK (sender_type IN ('customer', 'pharmacist')),
                message TEXT,
                image_url TEXT,
                is_read BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (consultation_id) REFERENCES consultations(id) 
                    ON DELETE CASCADE ON UPDATE CASCADE
            )
        `);
        log('s', 'Chat messages table created/verified');

        // Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_customer_id 
            ON consultations(customer_id)
        `);
        log('s', 'Index on consultations.customer_id created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_provider_id 
            ON consultations(provider_id)
        `);
        log('s', 'Index on consultations.provider_id created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_status 
            ON consultations(status)
        `);
        log('s', 'Index on consultations.status created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultations_updated_at 
            ON consultations(updated_at DESC)
        `);
        log('s', 'Index on consultations.updated_at created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_consultation_id 
            ON chat_messages(consultation_id)
        `);
        log('s', 'Index on chat_messages.consultation_id created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
            ON chat_messages(created_at DESC)
        `);
        log('s', 'Index on chat_messages.created_at created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id 
            ON chat_messages(sender_id)
        `);
        log('s', 'Index on chat_messages.sender_id created');

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read 
            ON chat_messages(is_read)
        `);
        log('s', 'Index on chat_messages.is_read created');

        log('s', 'All tables and indexes created successfully!');
        return true;
    } catch (error) {
        log('e', `Failed to create tables: ${error.message}`);
        return false;
    }
}

async function verifyTables() {
    try {
        log('i', 'Verifying table structure...');

        // Check consultations table
        const consultations = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name='consultations'
            ORDER BY ordinal_position
        `);

        if (consultations.rows.length === 0) {
            log('w', 'Consultations table not found');
            return false;
        }

        log('s', 'Consultations table structure:');
        consultations.rows.forEach(row => {
            console.log(`    ${COLORS.cyan}${row.column_name}${COLORS.reset}: ${row.data_type}`);
        });

        // Check chat_messages table
        const messages = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name='chat_messages'
            ORDER BY ordinal_position
        `);

        if (messages.rows.length === 0) {
            log('w', 'Chat messages table not found');
            return false;
        }

        log('s', 'Chat messages table structure:');
        messages.rows.forEach(row => {
            console.log(`    ${COLORS.cyan}${row.column_name}${COLORS.reset}: ${row.data_type}`);
        });

        return true;
    } catch (error) {
        log('e', `Failed to verify tables: ${error.message}`);
        return false;
    }
}

async function checkData() {
    try {
        log('i', 'Checking existing data...');

        const consultQuery = await pool.query('SELECT COUNT(*) as count FROM consultations');
        const messagesQuery = await pool.query('SELECT COUNT(*) as count FROM chat_messages');

        const consultCount = parseInt(consultQuery.rows[0].count);
        const messagesCount = parseInt(messagesQuery.rows[0].count);

        log('s', `Consultations: ${COLORS.cyan}${consultCount}${COLORS.reset} records`);
        log('s', `Messages: ${COLORS.cyan}${messagesCount}${COLORS.reset} records`);

        // Show sample data if exists
        if (consultCount > 0) {
            const sample = await pool.query(`
                SELECT id, customer_id, provider_id, status, created_at 
                FROM consultations 
                ORDER BY created_at DESC 
                LIMIT 3
            `);
            log('i', 'Recent consultations:');
            sample.rows.forEach(row => {
                console.log(`    ${COLORS.cyan}${row.id}${COLORS.reset} - Provider: ${row.provider_id}, Customer: ${row.customer_id}`);
            });
        }

        return true;
    } catch (error) {
        log('e', `Failed to check data: ${error.message}`);
        return false;
    }
}

async function runMigrations() {
    console.log(`
╔═══════════════════════════════════════════════╗
║  Chat System Database Initialization          ║
║  ${new Date().toLocaleString().padEnd(43)}║
╚═══════════════════════════════════════════════╝
    `);

    try {
        // Test connection
        log('i', 'Testing database connection...');
        await pool.query('SELECT NOW()');
        log('s', 'Connected to database');

        // Create tables
        const tablesCreated = await createTables();
        if (!tablesCreated) {
            throw new Error('Failed to create tables');
        }

        // Verify structure
        console.log('');
        const verified = await verifyTables();
        if (!verified) {
            throw new Error('Failed to verify tables');
        }

        // Check data
        console.log('');
        await checkData();

        console.log(`
${COLORS.green}✅ Database initialization complete!${COLORS.reset}

You can now:
1. Start the server: npm run start
2. Open chat in browser
3. Messages will be saved to postgresql database
        `);
    } catch (error) {
        console.log(`
${COLORS.red}❌ Initialization failed${COLORS.reset}
${error.message}

Make sure:
- PostgreSQL is running
- DATABASE_URL is set in .env
- Database user has CREATE TABLE permissions
        `);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run
runMigrations().catch(error => {
    log('e', `Fatal error: ${error.message}`);
    process.exit(1);
});
