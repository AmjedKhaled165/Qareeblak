const { Pool } = require('pg');
const path = require('path');

// Force load env
const envPath = path.join(__dirname, '..', '.env.local');
const dotEnvResult = require('dotenv').config({ path: envPath });
console.log('📝 Loaded .env.local from:', envPath, dotEnvResult.error ? '❌ ERROR' : '✅ OK');

if (process.env.DATABASE_URL) {
    // Force to 127.0.0.1 to avoid LAN IP resolution issues
    if (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('192.168.1.2')) {
        console.log('⚠️ Warning: DATABASE_URL contained non-local IP, forcing to 127.0.0.1');
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/@localhost/g, '@127.0.0.1').replace(/@192\.168\.1\.2/g, '@127.0.0.1');
    }
    const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
    console.log('📊 Final DATABASE_URL:', maskedUrl);
}

// Ensure postgres URL is valid
const databaseUrl = process.env.DATABASE_URL;
const isPostgresUrl = databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'));

const poolConfig = isPostgresUrl
    ? { connectionString: databaseUrl }
    : {
        host: '127.0.0.1', // Force loopback
        port: 5432,
        database: 'qareeblak',
        user: 'postgres',
        password: 'qareeblak123',
        client_encoding: 'UTF8'
    };

// Add pool management settings
const pool = new Pool({
    ...poolConfig,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test connection
pool.connect()
    .then(client => {
        console.log('✅ Connected to PostgreSQL database');
        client.release();
    })
    .catch(err => {
        console.error('❌ Database connection error:', err.message);
    });

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
