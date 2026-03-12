// Halan Partner Accounts Seeder (Updated)
// Run with: node seed-partners.js

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qareeblak',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

const partnerAccounts = [
    // Owner
    { name: 'حالا', username: 'halan', email: 'halan@halan.com', password: 'Halan#2026', user_type: 'partner_owner', phone: '01012345678' },

    // Supervisors
    { name: 'حاتم', username: 'hatem', email: 'hatem@halan.com', password: 'Hatem#2026', user_type: 'partner_supervisor', phone: '01122334455' },
    { name: 'حسين', username: 'hussein', email: 'hussein@halan.com', password: 'Hussein#2026', user_type: 'partner_supervisor', phone: '01277889900' },
    { name: 'أشرف', username: 'ashraf', email: 'ashraf@halan.com', password: 'Ashraf#2026', user_type: 'partner_supervisor', phone: '01555667788' },
    { name: 'محمد', username: 'mohamed', email: 'mohamed@halan.com', password: 'Mohamed#2026', user_type: 'partner_supervisor', phone: '01099887766' },

    // Couriers
    { name: 'عمر', username: 'omar', email: 'omar@courier.com', password: 'Omar#2026', user_type: 'partner_courier', phone: '01144556622' },
    { name: 'ياسين', username: 'yassin', email: 'yassin@courier.com', password: 'Yassin#2026', user_type: 'partner_courier', phone: '01288990011' },
    { name: 'حمزة', username: 'hamza', email: 'hamza@courier.com', password: 'Hamza@Ride2026', user_type: 'partner_courier', phone: '01066778899' },
    { name: 'زياد', username: 'ziad', email: 'ziad@courier.com', password: 'Ziad#2026', user_type: 'partner_courier', phone: '01500112233' },
    { name: 'سيف', username: 'seif', email: 'seif@courier.com', password: 'Seif#2026', user_type: 'partner_courier', phone: '01122112233' },
    { name: 'آدم', username: 'adam', email: 'adam@courier.com', password: 'Adam#2026', user_type: 'partner_courier', phone: '01233445566' },
    { name: 'يحيى', username: 'yehia', email: 'yehia@courier.com', password: 'Yehia#2026', user_type: 'partner_courier', phone: '01044332211' },
    { name: 'بلال', username: 'belal', email: 'belal@courier.com', password: 'Belal#2026', user_type: 'partner_courier', phone: '01555443322' },
    { name: 'أنس', username: 'anas', email: 'anas@courier.com', password: 'Anas#2026', user_type: 'partner_courier', phone: '01199880077' },
    { name: 'مروان', username: 'marwan', email: 'marwan@courier.com', password: 'Marwan#2026', user_type: 'partner_courier', phone: '01200998877' }
];

async function seedPartners() {
    console.log('🗑️  Deleting old partner accounts...\n');

    try {
        // Delete old partner accounts
        await pool.query(`
            DELETE FROM users 
            WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        `);
        console.log('✅ Old partner accounts deleted\n');

        console.log('🌱 Creating new partner accounts...\n');

        for (const account of partnerAccounts) {
            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(account.password, salt);

            // Insert user
            await pool.query(`
                INSERT INTO users (name, username, email, password, user_type, phone)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [account.name, account.username, account.email, hashedPassword, account.user_type, account.phone]);

            const roleAr = account.user_type === 'partner_owner' ? 'مالك' :
                account.user_type === 'partner_supervisor' ? 'مسؤول' : 'مندوب';
            console.log(`✅ Created ${roleAr}: ${account.username}`);
        }

        console.log('\n✨ Partner seeding completed! (15 accounts)');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
    } finally {
        await pool.end();
    }
}

seedPartners();
