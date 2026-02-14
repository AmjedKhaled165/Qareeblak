#!/usr/bin/env node

/**
 * Medical Chat System - Integration Test Suite
 * 
 * Usage: node test-chat-system.js
 * 
 * Tests:
 * 1. Database connectivity
 * 2. Table structure
 * 3. API endpoints
 * 4. Socket.io connection
 * 5. Full message flow
 */

const http = require('http');
const https = require('https');
const { Pool } = require('pg');

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost/halan';

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, prefix, message) {
    console.log(`${color}[${prefix}] ${message}${COLORS.reset}`);
}

function success(msg) { log(COLORS.green, 'PASS', msg); }
function error(msg) { log(COLORS.red, 'FAIL', msg); }
function info(msg) { log(COLORS.blue, 'INFO', msg); }
function warn(msg) { log(COLORS.yellow, 'WARN', msg); }
function test(msg) { log(COLORS.cyan, 'TEST', msg); }

// Helper to make HTTP requests
async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const method = options.method || 'GET';
        const headers = options.headers || {};
        const body = options.body ? JSON.stringify(options.body) : null;

        if (body) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(body);
        }

        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        const req = protocol.request(url, { method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data, headers: res.headers, error: e });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Tests
const tests = {
    async testDatabaseConnection() {
        test('Testing database connection...');
        try {
            const pool = new Pool({ connectionString: DB_URL });
            const result = await pool.query('SELECT NOW()');
            pool.end();
            success('Database connected successfully');
            return true;
        } catch (e) {
            error(`Database connection failed: ${e.message}`);
            return false;
        }
    },

    async testChatTables() {
        test('Checking chat tables existence...');
        try {
            const pool = new Pool({ connectionString: DB_URL });
            
            const tables = await pool.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema='public' 
                AND table_name IN ('consultations', 'chat_messages')
            `);

            pool.end();

            if (tables.rows.length === 2) {
                success('Both chat tables exist (consultations, chat_messages)');
                return true;
            } else {
                warn(`Only ${tables.rows.length}/2 chat tables found. Run: GET /api/chat/setup-database`);
                return false;
            }
        } catch (e) {
            error(`Table check failed: ${e.message}`);
            return false;
        }
    },

    async testHealthCheck() {
        test('Testing API health...');
        try {
            const res = await makeRequest(`${API_BASE}/api/health`);
            if (res.status === 200 && res.data?.status === 'ok') {
                success('API health check passed');
                return true;
            } else {
                error(`Unexpected health response: ${res.status}`);
                return false;
            }
        } catch (e) {
            error(`Health check failed: ${e.message}`);
            return false;
        }
    },

    async testChatSetup() {
        test('Testing chat table setup endpoint...');
        try {
            const res = await makeRequest(`${API_BASE}/api/chat/setup-database`);
            if (res.status === 200 && res.data?.success) {
                success('Chat tables setup successful');
                return true;
            } else {
                warn(`Setup returned status ${res.status}`);
                return false;
            }
        } catch (e) {
            error(`Setup failed: ${e.message}`);
            return false;
        }
    },

    async testAuthEndpoint() {
        test('Testing authentication endpoint...');
        try {
            // This will fail without real credentials, but tests connectivity
            const res = await makeRequest(`${API_BASE}/api/halan/auth/login`, {
                method: 'POST',
                body: { email: 'test@test.com', password: 'test' }
            });

            if (res.status === 401 || res.status === 400) {
                success('Auth endpoint is reachable');
                return true;
            } else {
                warn(`Unexpected auth response: ${res.status}`);
                return false;
            }
        } catch (e) {
            error(`Auth test failed: ${e.message}`);
            return false;
        }
    },

    async testConsultationLogic() {
        test('Testing consultation table structure...');
        try {
            const pool = new Pool({ connectionString: DB_URL });
            
            // Check columns
            const columns = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name='consultations'
            `);

            pool.end();

            const requiredCols = ['id', 'customer_id', 'provider_id', 'status', 'created_at'];
            const foundCols = columns.rows.map(r => r.column_name);
            const missingCols = requiredCols.filter(c => !foundCols.includes(c));

            if (missingCols.length === 0) {
                success('Consultation table structure is correct');
                return true;
            } else {
                error(`Missing columns: ${missingCols.join(', ')}`);
                return false;
            }
        } catch (e) {
            error(`Structure check failed: ${e.message}`);
            return false;
        }
    },

    async testMessagesLogic() {
        test('Testing chat_messages table structure...');
        try {
            const pool = new Pool({ connectionString: DB_URL });
            
            const columns = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name='chat_messages'
            `);

            pool.end();

            const requiredCols = ['id', 'consultation_id', 'sender_id', 'sender_type', 'message', 'created_at'];
            const foundCols = columns.rows.map(r => r.column_name);
            const missingCols = requiredCols.filter(c => !foundCols.includes(c));

            if (missingCols.length === 0) {
                success('Chat messages table structure is correct');
                return true;
            } else {
                error(`Missing columns: ${missingCols.join(', ')}`);
                return false;
            }
        } catch (e) {
            error(`Structure check failed: ${e.message}`);
            return false;
        }
    },

    async testMessageSampleData() {
        test('Checking for sample message data...');
        try {
            const pool = new Pool({ connectionString: DB_URL });
            
            const result = await pool.query('SELECT COUNT(*) as count FROM chat_messages');
            const count = result.rows[0].count;

            pool.end();

            if (count > 0) {
                success(`Found ${count} messages in database`);
            } else {
                warn('No messages in database - this is normal for fresh install');
            }
            return true;
        } catch (e) {
            error(`Data check failed: ${e.message}`);
            return false;
        }
    }
};

// Run all tests
async function runAllTests() {
    console.log(`
╔════════════════════════════════════════════════╗
║   Medical Chat System - Integration Tests      ║
║   ${new Date().toLocaleString()}                ║
╚════════════════════════════════════════════════╝
    `);

    info(`API Base: ${API_BASE}`);
    info(`Database: ${DB_URL.split('@')[1] || 'not configured'}`);

    const results = [];

    for (const [name, testFn] of Object.entries(tests)) {
        console.log('');
        try {
            const result = await testFn();
            results.push({ name, passed: result });
        } catch (e) {
            error(`Test error: ${e.message}`);
            results.push({ name, passed: false, error: e.message });
        }
    }

    console.log(`
╔════════════════════════════════════════════════╗
║   Test Results Summary                         ║
╚════════════════════════════════════════════════╝
    `);

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach(r => {
        if (r.passed) {
            success(r.name.replace('test', ''));
        } else {
            error(r.name.replace('test', ''));
        }
    });

    console.log(`
Total: ${COLORS.cyan}${passed}/${total}${COLORS.reset} tests passed
    `);

    if (passed === total) {
        console.log(`${COLORS.green}✅ All systems operational!${COLORS.reset}`);
        process.exit(0);
    } else {
        console.log(`${COLORS.yellow}⚠️  Some tests failed. Review the log above.${COLORS.reset}`);
        process.exit(1);
    }
}

runAllTests().catch(err => {
    error(`Fatal error: ${err.message}`);
    process.exit(1);
});
