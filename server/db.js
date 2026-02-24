const { Pool } = require('pg');
const path = require('path');
const logger = require('./utils/logger');

// Force load env
const envPath = path.join(__dirname, '..', '.env.local');
const dotEnvResult = require('dotenv').config({ path: envPath });

if (process.env.DATABASE_URL) {
    // Force to 127.0.0.1 to avoid LAN IP resolution issues (dev only)
    if (process.env.NODE_ENV !== 'production' && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('192.168.1.2'))) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/@localhost/g, '@127.0.0.1').replace(/@192\.168\.1\.2/g, '@127.0.0.1');
    }
} else {
    logger.error('🔥 FATAL ERROR: DATABASE_URL IS MISSING. SERVER REFUSES TO START.');
    process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

// Enterprise pool management settings
const pool = new Pool({
    connectionString: databaseUrl,
    max: process.env.NODE_ENV === 'production' ? 100 : 20, // Max clients per instance
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500 // Close idle connections after usage to prevent memory leaks
});

// Immediately test connection and fail fast if down in production
pool.connect()
    .then(client => {
        logger.info('✅ Connected to PostgreSQL database pool');
        client.release();
    })
    .catch(err => {
        logger.error('❌ Database connection error:', err.message);
        if (process.env.NODE_ENV === 'production') {
            logger.error('🔥 PRODUCTION FATAL: Exiting due to missed DB connection');
            process.exit(1);
        } else {
            logger.warn('⚠️ Development Mode: Server will stay alive despite DB failure.');
        }
    });

// Handle idle client errors
pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', err);
});

module.exports = pool;
