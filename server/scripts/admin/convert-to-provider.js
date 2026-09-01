/* eslint-disable */
const db = require('./db');
const { pool } = db;

const args = process.argv.slice(2);

if (args.length < 3) {
    console.log('Usage: node server/convert-to-provider.js <identifier> <category> <provider_name>');
    console.log('Example: node server/convert-to-provider.js admin@waticket.com medical "Dr. Amjed Clinic"');
    process.exit(1);
}

const identifier = args[0];
const category = args[1];
const providerName = args[2];

async function convertToProvider() {
    try {
        console.log(`🔍 Processing conversion for user: "${identifier}"...`);

        // 1. Find User
        let queryStr = 'SELECT id, name, username, email, phone, user_type FROM users WHERE username = $1 OR email = $1';
        let queryParams = [identifier];

        if (!isNaN(identifier)) {
            queryStr = 'SELECT id, name, username, email, phone, user_type FROM users WHERE id = $1';
            queryParams = [parseInt(identifier)];
        }

        const userCheck = await db.query(queryStr, queryParams);

        if (userCheck.rows.length === 0) {
            console.error(`❌ User not found: ${identifier}`);
            process.exit(1);
        }

        const user = userCheck.rows[0];
        console.log(`✅ Found User: ${user.name} (ID: ${user.id})`);

        // 2. Update User Type
        if (user.user_type !== 'provider') {
            console.log(`🔄 Updating user_type from '${user.user_type}' to 'provider'...`);
            await db.query("UPDATE users SET user_type = 'provider' WHERE id = $1", [user.id]);
        } else {
            console.log(`ℹ️ user_type is already 'provider'.`);
        }

        // 3. Upsert Provider Entry
        const providerCheck = await db.query('SELECT id FROM providers WHERE user_id = $1', [user.id]);

        if (providerCheck.rows.length > 0) {
            console.log(`🔄 Updating existing provider entry...`);
            await db.query(
                "UPDATE providers SET name = $1, category = $2, is_approved = true WHERE user_id = $3",
                [providerName, category, user.id]
            );
        } else {
            console.log(`➕ Creating new provider entry...`);
            // Use user phone or placeholder if unavailable
            const phone = user.phone || '0000000000';
            const location = 'Default Location';

            await db.query(
                `INSERT INTO providers (user_id, name, email, category, location, phone, is_approved) 
                 VALUES ($1, $2, $3, $4, $5, $6, true)`,
                [user.id, providerName, user.email, category, location, phone]
            );
        }

        console.log(`\n🎉 User successfully converted to Service Provider!`);
        console.log(`User: ${user.email}`);
        console.log(`Role: provider`);
        console.log(`Category: ${category}`);
        console.log(`Provider Name: ${providerName}`);

    } catch (error) {
        console.error('❌ Error converting to provider:', error);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

convertToProvider();
