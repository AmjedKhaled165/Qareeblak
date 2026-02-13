/* eslint-disable */
const db = require('./db');
const { pool } = db;

const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('Usage: node server/check-provider-status.js <identifier>');
    process.exit(1);
}

const identifier = args[0];

async function checkProviderStatus() {
    try {
        console.log(`🔍 Checking provider status for: "${identifier}"...`);

        // Find user
        let queryStr = 'SELECT id, name, username, email, user_type FROM users WHERE username = $1 OR email = $1';
        let queryParams = [identifier];

        if (!isNaN(identifier)) {
            queryStr = 'SELECT id, name, username, email, user_type FROM users WHERE id = $1';
            queryParams = [parseInt(identifier)];
        }

        const userCheck = await db.query(queryStr, queryParams);

        if (userCheck.rows.length === 0) {
            console.error(`❌ User not found: ${identifier}`);
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log(`✅ Found User: ${user.name} (ID: ${user.id})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current Role: ${user.user_type}`);

        // Check providers table
        const providerCheck = await db.query('SELECT * FROM providers WHERE user_id = $1', [user.id]);

        if (providerCheck.rows.length > 0) {
            const provider = providerCheck.rows[0];
            console.log(`✅ Found Provider Entry:`);
            console.log(`   Provider ID: ${provider.id}`);
            console.log(`   Provider Name: ${provider.name}`);
            console.log(`   Category: ${provider.category}`);
            console.log(`   Is Approved: ${provider.is_approved}`);
        } else {
            console.log(`❌ No entry found in 'providers' table for this user.`);
            console.log(`   This user cannot log in as a Service Provider until they are added to the providers table.`);
        }

    } catch (error) {
        console.error('❌ Error checking provider status:', error);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

checkProviderStatus();
