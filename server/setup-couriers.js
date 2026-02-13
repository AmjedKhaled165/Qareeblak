// Check and Create Test Couriers
/* eslint-disable */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:qareeblak123@127.0.0.1:5432/qareeblak'
});

async function setupTestCouriers() {
    try {
        console.log('🔍 Checking existing partner users...\n');

        const existingUsers = await pool.query(`
            SELECT id, name, username, user_type, is_available 
            FROM users 
            WHERE user_type LIKE 'partner%' 
            ORDER BY user_type, name
        `);

        console.log('═'.repeat(70));
        console.log('Current Partner Users:');
        console.log('═'.repeat(70));

        if (existingUsers.rows.length === 0) {
            console.log('❌ No partner users found in database!\n');
        } else {
            existingUsers.rows.forEach(user => {
                const role = user.user_type.replace('partner_', '');
                const status = user.is_available ? '🟢 Online' : '⚪ Offline';
                console.log(`${status} | ${role.toUpperCase().padEnd(10)} | ${user.name.padEnd(20)} | @${user.username}`);
            });
            console.log('\n');
        }

        // Check specifically for couriers
        const couriers = existingUsers.rows.filter(u => u.user_type === 'partner_courier');
        console.log(`📊 Total Couriers: ${couriers.length}\n`);

        if (couriers.length === 0) {
            console.log('💡 Creating test couriers...\n');

            const testCouriers = [
                { name: 'أحمد محمد', username: 'ahmed_driver', phone: '01012345671' },
                { name: 'محمود علي', username: 'mahmoud_driver', phone: '01012345672' },
                { name: 'كريم حسن', username: 'karim_driver', phone: '01012345673' }
            ];

            const hashedPassword = await bcrypt.hash('123456', 10);

            for (const courier of testCouriers) {
                try {
                    await pool.query(
                        `INSERT INTO users (name, username, phone, password, user_type, is_available)
                         VALUES ($1, $2, $3, $4, 'partner_courier', true)
                         ON CONFLICT (username) DO NOTHING`,
                        [courier.name, courier.username, courier.phone, hashedPassword]
                    );
                    console.log(`✅ Created courier: ${courier.name} (@${courier.username})`);
                } catch (err) {
                    console.log(`⚠️  Courier ${courier.username} already exists`);
                }
            }

            console.log('\n✨ Test couriers created successfully!');
            console.log('📝 Default password for all test couriers: 123456');
        } else {
            console.log('✅ Couriers already exist in database');
        }

        // Show supervisor assignments
        const assignments = await pool.query(`
            SELECT 
                u1.name as courier_name,
                u1.username as courier_username,
                u2.name as supervisor_name,
                u2.username as supervisor_username
            FROM courier_supervisors cs
            JOIN users u1 ON cs.courier_id = u1.id
            JOIN users u2 ON cs.supervisor_id = u2.id
            ORDER BY u1.name
        `);

        if (assignments.rows.length > 0) {
            console.log('\n═'.repeat(70));
            console.log('Courier → Supervisor Assignments:');
            console.log('═'.repeat(70));
            assignments.rows.forEach(a => {
                console.log(`👤 ${a.courier_name} (@${a.courier_username}) → 👔 ${a.supervisor_name} (@${a.supervisor_username})`);
            });
        } else {
            console.log('\n💡 No courier-supervisor assignments yet');
        }

        console.log('\n' + '═'.repeat(70));
        console.log('🎯 Next Steps:');
        console.log('═'.repeat(70));
        console.log('1. Refresh the page: http://localhost:3000/partner/all-drivers');
        console.log('2. You should now see the couriers in the list');
        console.log('3. Use the "+" button to add more couriers if needed\n');

        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

setupTestCouriers();
