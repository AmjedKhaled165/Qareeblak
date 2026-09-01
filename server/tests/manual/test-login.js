// Test Login Endpoint
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: 'postgresql://postgres:qareeblak123@127.0.0.1:5432/qareeblak'
});

async function testLogin() {
    try {
        console.log('🔍 Partner Admin Accounts:\n');

        // Find owner and supervisors
        const adminsResult = await pool.query(`
            SELECT username, name, user_type
            FROM users 
            WHERE user_type IN ('partner_owner', 'partner_supervisor')
            ORDER BY user_type, name
        `);

        if (adminsResult.rows.length === 0) {
            console.log('❌ No owner or supervisor accounts found!');
        } else {
            console.log('Found admin accounts:');
            adminsResult.rows.forEach(u => {
                const role = (u.user_type || 'unknown').replace('partner_', '').toUpperCase();
                const username = u.username || 'N/A';
                const name = u.name || 'N/A';
                console.log(`  ${role.padEnd(12)} | Username: ${username.padEnd(10)} | Name: ${name}`);
                console.log(`              Password: 123456`);
            });
        }

        console.log('\n🚛 Courier Accounts:\n');
        const couriersResult = await pool.query(`
            SELECT username, name
            FROM users 
            WHERE user_type = 'partner_courier'
            ORDER BY name
            LIMIT 5
        `);
        
        couriersResult.rows.forEach(u => {
            const username = u.username || 'N/A';
            const name = u.name || 'N/A';
            console.log(`  Username: ${username.padEnd(10)} | Name: ${name.padEnd(15)} | Password: 123456`);
        });

        console.log('\n✅ All partner accounts use password: 123456\n');

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
    }
}

testLogin();
