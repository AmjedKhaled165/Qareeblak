const { Pool } = require('pg');
const path = require('path');
const os = require('os');
const logger = require('./utils/logger');
const { dbQueryDurationSeconds } = require('./utils/metrics');
const chaos = require('./utils/resilience');

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

// Detect remote/cloud DB — Neon.tech, Supabase, or any production env requires SSL
const isProduction = process.env.NODE_ENV === 'production';
const isRemoteDb = databaseUrl.includes('neon.tech') || databaseUrl.includes('supabase') || isProduction;

// Safety mechanism for multi-core scaling (PM2 Cluster)
const totalCpus = os.cpus().length || 4;
// Limit PM2 instances to not exceed max DB connection limit (default 100 on standard PostgreSQL)
const MAX_POSTGRES_CONNECTIONS = process.env.DB_MAX_CONNECTIONS || 90;
const poolMaxPerInstance = isProduction ? Math.floor(MAX_POSTGRES_CONNECTIONS / totalCpus) : 20;

// Strip unsupported params from connection string to avoid conflicts with pool ssl config
// pg doesn't support: sslmode, channel_binding, uselibpqcompat — strip them all
const cleanDatabaseUrl = databaseUrl
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/[?&]uselibpqcompat=[^&]*/g, '')
    // Clean up any dangling ? or & left after stripping
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');

const pool = new Pool({
    connectionString: cleanDatabaseUrl,
    max: Math.max(poolMaxPerInstance, 5), // Ensure at least 5 connections per instance even on huge machines
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500, // Close idle connections after usage to prevent memory leaks
    ...(isRemoteDb && { ssl: { rejectUnauthorized: false } })
});

// 📊 [Big Tech Tier] Database Instrumentation
const originalQuery = pool.query;
pool.query = async function (text, params) {
    await chaos.inject(); // Simulation point
    const start = Date.now();
    try {
        const result = await originalQuery.call(this, text, params);
        const duration = (Date.now() - start) / 1000;
        dbQueryDurationSeconds.observe({ query_type: 'pool_query' }, duration);
        return result;
    } catch (err) {
        throw err;
    }
};

// Immediately test connection with retries to avoid cold-start race failures.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const verifyDatabaseConnection = async () => {
    const isProd = process.env.NODE_ENV === 'production';
    const attempts = isProd ? 5 : 1;

    for (let i = 1; i <= attempts; i++) {
        try {
            const client = await pool.connect();
            logger.info('✅ Connected to PostgreSQL database pool');
            client.release();
            return;
        } catch (err) {
            logger.error(`❌ Database connection error (attempt ${i}/${attempts}):`, err.message);
            if (i < attempts) {
                await delay(2000);
            }
        }
    }

    if (isProd) {
        logger.error('🔥 PRODUCTION FATAL: Exiting after DB connection retries failed');
        process.exit(1);
    } else {
        logger.warn('⚠️ Development Mode: Server will stay alive despite DB failure.');
    }
};

verifyDatabaseConnection();

// Handle idle client errors
pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', err);
});

module.exports = pool;
