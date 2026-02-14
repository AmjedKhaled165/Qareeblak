const { Pool } = require('pg');
const path = require('path');

// Load environment variables from multiple locations
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

// Debug: log what we're using
if (process.env.DATABASE_URL) {
    console.log('📊 Using DATABASE_URL for connection');
}

// Support both DATABASE_URL and individual variables
// Ensure DATABASE_URL is a postgres URL (prevents picking up SQLite file: URLs from root)
const databaseUrl = process.env.DATABASE_URL;
const isPostgresUrl = databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'));

const poolConfig = isPostgresUrl
    ? { connectionString: databaseUrl }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'qareeblak',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        client_encoding: 'UTF8'
    };

const logger = require('./utils/logger');

// Add pool management settings
const pool = new Pool({
    ...poolConfig,
    max: 20,              // Connection pool size for 100k users
    idleTimeoutMillis: 10000, // Faster resource cleanup
    connectionTimeoutMillis: 5000,
    maxUses: 7500,        // Prevent memory leaks by cycling connections
});

// Lifecycle Event Monitoring
pool.on('connect', () => {
    logger.info('🛰️ New database connection established from pool');
});

pool.on('error', (err) => {
    logger.error('💥 UNEXPECTED DATABASE ERROR:', err);
});

// Test connection on boot
const testConnection = async () => {
    try {
        const client = await pool.connect();
        logger.info('✅ Database is Online and Responsive');
        client.release();
    } catch (err) {
        logger.error('🛑 DATABASE CONNECTION FAILED:', err.message);
        if (process.env.NODE_ENV === 'production') process.exit(1);
    }
};

testConnection();

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
