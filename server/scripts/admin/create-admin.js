// Create Admin User Script
// Run this to create the first admin user for the Halan system

const bcrypt = require('bcryptjs');
/* eslint-disable */
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function createAdminUser() {
    try {
        console.log('🔍 Checking for existing admin users...');

        // Check if any partner_owner exists
        const checkResult = await pool.query(
            "SELECT id, name, username FROM users WHERE user_type = 'partner_owner' LIMIT 1"
        );

        if (checkResult.rows.length > 0) {
            const admin = checkResult.rows[0];
            console.log('✅ Admin user already exists:', {
                id: admin.id,
                name: admin.name,
                username: admin.username
            });
            console.log('\n💡 Use these credentials to login at: http://localhost:3000/partner/login');
            await pool.end();
            return;
        }

        console.log('📝 No admin user found. Creating default admin...');

        // Default admin credentials
        const adminData = {
            name: 'Admin',
            username: 'admin',
            email: 'admin@halan.local',
            password: 'admin123',
            phone: '01000000000'
        };

        // Hash password
        const hashedPassword = await bcrypt.hash(adminData.password, 10);

        // Insert admin user
        const result = await pool.query(
            `INSERT INTO users (name, username, email, phone, password, user_type, is_available) 
             VALUES ($1, $2, $3, $4, $5, 'partner_owner', true) 
             RETURNING id, name, username, email`,
            [adminData.name, adminData.username, adminData.email, adminData.phone, hashedPassword]
        );

        const newAdmin = result.rows[0];
        console.log('\n✅ Admin user created successfully!');
        console.log('═'.repeat(60));
        console.log('📋 Login Credentials:');
        console.log('   Username:', adminData.username);
        console.log('   Password:', adminData.password);
        console.log('   Login URL: http://localhost:3000/partner/login');
        console.log('═'.repeat(60));
        console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');

        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === '23505') {
            console.log('\n💡 Admin user already exists. Try logging in with existing credentials.');
        }
        await pool.end();
        process.exit(1);
    }
}

createAdminUser();
