const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const db = require('../../db');

const CUSTOMERS = [
    {
        name: 'يوسف طارق',
        email: 'youssef.client@example.com',
        password: 'Youssef!2026',
        phone: '01088774433'
    },
    {
        name: 'ندى إبراهيم',
        email: 'nada.customer@example.com',
        password: 'Nada#Buy26',
        phone: '01155992211'
    },
    {
        name: 'مصطفى السيد',
        email: 'mostafa.user@example.com',
        password: 'Mostafa$99',
        phone: '01222334488'
    }
];

async function getUserColumns(client) {
    const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
    `);
    return new Set(result.rows.map((r) => r.column_name));
}

async function upsertCustomer(client, columns, account) {
    const hashedPassword = await bcrypt.hash(account.password, 12);

    const existing = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [account.email]
    );

    if (existing.rows.length > 0) {
        const userId = existing.rows[0].id;
        const fields = ['name = $1', 'password = $2', "user_type = 'customer'"];
        const values = [account.name, hashedPassword];

        if (columns.has('phone')) {
            fields.push('phone = $3');
            values.push(account.phone);
            values.push(userId);
            await client.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $4 RETURNING id, name, email, user_type, phone`,
                values
            );
        } else {
            values.push(userId);
            await client.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $3 RETURNING id, name, email, user_type`,
                values
            );
        }

        return { id: userId, action: 'updated' };
    }

    if (columns.has('phone')) {
        const inserted = await client.query(
            `INSERT INTO users (name, email, password, phone, user_type)
             VALUES ($1, $2, $3, $4, 'customer')
             RETURNING id`,
            [account.name, account.email, hashedPassword, account.phone]
        );

        return { id: inserted.rows[0].id, action: 'created' };
    }

    const inserted = await client.query(
        `INSERT INTO users (name, email, password, user_type)
         VALUES ($1, $2, $3, 'customer')
         RETURNING id`,
        [account.name, account.email, hashedPassword]
    );

    return { id: inserted.rows[0].id, action: 'created' };
}

async function run() {
    const client = await db.connect();

    try {
        await client.query('BEGIN');
        const userColumns = await getUserColumns(client);

        for (const customer of CUSTOMERS) {
            const result = await upsertCustomer(client, userColumns, customer);
            console.log(`✅ Customer ${result.action}: ${customer.email} (id=${result.id})`);
        }

        await client.query('COMMIT');
        console.log('✨ Customer accounts seeded/updated successfully (3 accounts)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Customer seeding failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end().catch(() => {});
    }
}

run();
