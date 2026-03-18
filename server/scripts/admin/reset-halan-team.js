/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const db = require('../../db');

const TEAM = [
    { name: 'حالا', username: 'halan', email: 'halan@halan.com', password: 'Halan#2026', role: 'partner_owner', phone: '01012345678' },
    { name: 'حاتم', username: 'hatem', email: 'hatem@halan.com', password: 'Hatem#2026', role: 'partner_supervisor', phone: '01122334455' },
    { name: 'حسين', username: 'hussein', email: 'hussein@halan.com', password: 'Hussein#2026', role: 'partner_supervisor', phone: '01277889900' },
    { name: 'أشرف', username: 'ashraf', email: 'ashraf@halan.com', password: 'Ashraf#2026', role: 'partner_supervisor', phone: '01555667788' },
    { name: 'محمد', username: 'mohamed', email: 'mohamed@halan.com', password: 'Mohamed#2026', role: 'partner_supervisor', phone: '01099887766' },
    { name: 'عمر', username: 'omar', email: 'omar@courier.com', password: 'Omar#2026', role: 'partner_courier', phone: '01144556622' },
    { name: 'ياسين', username: 'yassin', email: 'yassin@courier.com', password: 'Yassin#2026', role: 'partner_courier', phone: '01288990011' },
    { name: 'حمزة', username: 'hamza', email: 'hamza@courier.com', password: 'Hamza@Ride2026', role: 'partner_courier', phone: '01066778899' },
    { name: 'زياد', username: 'ziad', email: 'ziad@courier.com', password: 'Ziad#2026', role: 'partner_courier', phone: '01500112233' },
    { name: 'سيف', username: 'seif', email: 'seif@courier.com', password: 'Seif#2026', role: 'partner_courier', phone: '01122112233' },
    { name: 'آدم', username: 'adam', email: 'adam@courier.com', password: 'Adam#2026', role: 'partner_courier', phone: '01233445566' },
    { name: 'يحيى', username: 'yehia', email: 'yehia@courier.com', password: 'Yehia#2026', role: 'partner_courier', phone: '01044332211' },
    { name: 'بلال', username: 'belal', email: 'belal@courier.com', password: 'Belal#2026', role: 'partner_courier', phone: '01555443322' },
    { name: 'أنس', username: 'anas', email: 'anas@courier.com', password: 'Anas#2026', role: 'partner_courier', phone: '01199880077' },
    { name: 'مروان', username: 'marwan', email: 'marwan@courier.com', password: 'Marwan#2026', role: 'partner_courier', phone: '01200998877' },
];

const SUPERVISOR_ASSIGNMENTS = {
    hatem: ['omar', 'yassin'],
    hussein: ['hamza', 'ziad'],
    ashraf: ['seif', 'adam'],
    mohamed: ['yehia', 'belal', 'anas', 'marwan'],
};

async function getUserColumns(client) {
    const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
    `);
    return new Set(result.rows.map((r) => r.column_name));
}

async function ensureCourierSupervisorsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS courier_supervisors (
            courier_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            supervisor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (courier_id, supervisor_id)
        )
    `);
}

async function cleanupLegacyPartnerData(client) {
    await client.query(`
        UPDATE delivery_orders
        SET courier_id = NULL
        WHERE courier_id IN (
            SELECT id FROM users WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        )
    `);

    await client.query(`
        UPDATE delivery_orders
        SET supervisor_id = NULL
        WHERE supervisor_id IN (
            SELECT id FROM users WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        )
    `);

    await client.query(`
        DELETE FROM courier_supervisors
        WHERE courier_id IN (
            SELECT id FROM users WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        )
        OR supervisor_id IN (
            SELECT id FROM users WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        )
    `);

    const del = await client.query(`
        DELETE FROM users
        WHERE user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        RETURNING id
    `);

    console.log(`🗑️ Deleted old Halan users: ${del.rowCount}`);
}

function buildInsertForUser(columns) {
    const fields = ['name', 'password', 'user_type'];
    if (columns.has('username')) fields.push('username');
    if (columns.has('email')) fields.push('email');
    if (columns.has('phone')) fields.push('phone');
    if (columns.has('is_available')) fields.push('is_available');

    const placeholders = fields.map((_, i) => `$${i + 1}`);
    const sql = `
        INSERT INTO users (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING id, name, username, email, phone, user_type
    `;

    return { sql, fields };
}

function buildInsertValues(account, hashedPassword, fields) {
    return fields.map((f) => {
        if (f === 'name') return account.name;
        if (f === 'password') return hashedPassword;
        if (f === 'user_type') return account.role;
        if (f === 'username') return account.username;
        if (f === 'email') return account.email;
        if (f === 'phone') return account.phone;
        if (f === 'is_available') return account.role === 'partner_courier';
        return null;
    });
}

async function seedTeam(client, columns) {
    const { sql, fields } = buildInsertForUser(columns);
    const byUsername = new Map();

    for (const account of TEAM) {
        const hashed = await bcrypt.hash(account.password, 10);
        const values = buildInsertValues(account, hashed, fields);
        const created = await client.query(sql, values);
        const user = created.rows[0];
        byUsername.set(account.username, user.id);
        console.log(`✅ Created ${account.role}: ${account.username} (id=${user.id})`);
    }

    return byUsername;
}

async function assignCouriers(client, byUsername) {
    for (const [supervisorUsername, courierUsernames] of Object.entries(SUPERVISOR_ASSIGNMENTS)) {
        const supervisorId = byUsername.get(supervisorUsername);
        if (!supervisorId) continue;

        for (const courierUsername of courierUsernames) {
            const courierId = byUsername.get(courierUsername);
            if (!courierId) continue;

            await client.query(
                `INSERT INTO courier_supervisors (courier_id, supervisor_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [courierId, supervisorId]
            );
        }
    }

    console.log('🔗 Courier-supervisor assignments applied');
}

async function run() {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const userColumns = await getUserColumns(client);
        await ensureCourierSupervisorsTable(client);
        await cleanupLegacyPartnerData(client);

        const byUsername = await seedTeam(client, userColumns);
        await assignCouriers(client, byUsername);

        await client.query('COMMIT');
        console.log('✨ Halan team reset completed successfully (15 users)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Halan team reset failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end().catch(() => {});
    }
}

run();
