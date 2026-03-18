/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const db = require('../../db');

const PROVIDERS = [
    {
        name: 'طارق حسن',
        email: 'tarek.food@example.com',
        username: 'tarek_food',
        phone: '01011223344',
        password: 'TarekFood@2026!',
        category: 'مطعم / كافيه',
        location: 'الحي الأول، المجاورة الثانية، عمارة 15',
        bio: 'تقديم أشهى المأكولات الشرقية والغربية بالإضافة إلى قائمة متنوعة من المشروبات الساخنة والباردة.'
    },
    {
        name: 'مصطفى كمال',
        email: 'mostafa.maint@example.com',
        username: 'mostafa_maint',
        phone: '01155667788',
        password: 'MostafaFix#99',
        category: 'صيانة (سباكة/كهرباء)',
        location: 'الحي الثاني، المجاورة الرابعة، محل رقم 3',
        bio: 'صيانة فورية لجميع أعطال الكهرباء والسباكة المنزلية والتجارية بدقة واحترافية عالية.'
    },
    {
        name: 'د. خالد عبدالرحمن',
        email: 'khaled.pharma@example.com',
        username: 'khaled_pharma',
        phone: '01233445577',
        password: 'KhaledMed$2026',
        category: 'طبي / صيدلية',
        location: 'الحي الثالث، المجاورة الأولى، ميدان الزهور',
        bio: 'صيدلية متكاملة توفر جميع الأدوية، مستحضرات التجميل، العناية بالطفل، وخدمات قياس الضغط والسكر.'
    },
    {
        name: 'محمود جمال',
        email: 'mahmoud.cars@example.com',
        username: 'mahmoud_cars',
        phone: '01555668899',
        password: 'CarsMahmoud*77',
        category: 'خدمات سيارات',
        location: 'المنطقة الصناعية، بلوك 4، ورشة رقم 12',
        bio: 'مركز خدمة متكامل لغسيل السيارات، تغيير الزيوت، الفحص الدوري، وتلميع السيارات.'
    },
    {
        name: 'إبراهيم سعيد',
        email: 'ibrahim.market@example.com',
        username: 'ibrahim_market',
        phone: '01099887755',
        password: 'MarketIbra@26',
        category: 'سوبر ماركت',
        location: 'الحي الرابع، المجاورة الثالثة، السوق التجاري',
        bio: 'توفير جميع السلع الغذائية، المعلبات، المنظفات، والمنتجات الاستهلاكية اليومية بأسعار تنافسية.'
    },
    {
        name: 'علي منصور',
        email: 'ali.laundry@example.com',
        username: 'ali_laundry',
        phone: '01122334477',
        password: 'AliClean!2026',
        category: 'أخرى',
        location: 'الحي الخامس، سنتر المدينة، محل رقم 5',
        bio: 'خدمات الغسيل، الكي بالبخار، وتنظيف السجاد والمفروشات بأحدث الأجهزة.'
    }
];

async function getColumns(tableName, client) {
    const result = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
    );
    return new Set(result.rows.map((r) => r.column_name));
}

async function upsertUser(client, userColumns, account) {
    const hashedPassword = await bcrypt.hash(account.password, 12);
    const hasUsername = userColumns.has('username');

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [account.email]);

    if (existing.rows.length > 0) {
        const userId = existing.rows[0].id;

        const fields = ['name = $1', 'phone = $2', 'password = $3', "user_type = 'provider'"];
        const params = [account.name, account.phone, hashedPassword];

        if (hasUsername) {
            fields.push('username = $4');
            params.push(account.username);
            params.push(userId);
            await client.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $5 RETURNING id`,
                params
            );
        } else {
            params.push(userId);
            await client.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $4 RETURNING id`,
                params
            );
        }

        return userId;
    }

    if (hasUsername) {
        const inserted = await client.query(
            `INSERT INTO users (name, username, email, phone, password, user_type)
             VALUES ($1, $2, $3, $4, $5, 'provider')
             RETURNING id`,
            [account.name, account.username, account.email, account.phone, hashedPassword]
        );
        return inserted.rows[0].id;
    }

    const inserted = await client.query(
        `INSERT INTO users (name, email, phone, password, user_type)
         VALUES ($1, $2, $3, $4, 'provider')
         RETURNING id`,
        [account.name, account.email, account.phone, hashedPassword]
    );

    return inserted.rows[0].id;
}

function buildProviderUpdate(providerColumns, account, userId) {
    const updateFields = [];
    const updateValues = [];

    const push = (field, value) => {
        if (!providerColumns.has(field)) return;
        updateFields.push(`${field} = $${updateValues.length + 1}`);
        updateValues.push(value);
    };

    push('user_id', userId);
    push('name', account.name);
    push('email', account.email);
    push('category', account.category);
    push('location', account.location);
    push('phone', account.phone);
    push('is_approved', true);

    if (providerColumns.has('description')) push('description', account.bio);
    if (providerColumns.has('about')) push('about', account.bio);
    if (providerColumns.has('bio')) push('bio', account.bio);
    if (providerColumns.has('is_banned')) push('is_banned', false);

    return { updateFields, updateValues };
}

async function upsertProvider(client, providerColumns, account, userId) {
    const existing = await client.query(
        `SELECT id FROM providers WHERE user_id = $1 OR LOWER(email) = LOWER($2) LIMIT 1`,
        [userId, account.email]
    );

    const { updateFields, updateValues } = buildProviderUpdate(providerColumns, account, userId);

    if (existing.rows.length > 0) {
        const providerId = existing.rows[0].id;
        const params = [...updateValues, providerId];

        if (updateFields.length > 0) {
            await client.query(
                `UPDATE providers SET ${updateFields.join(', ')} WHERE id = $${params.length}`,
                params
            );
        }

        return providerId;
    }

    const fields = [];
    const values = [];
    const push = (field, value) => {
        if (!providerColumns.has(field)) return;
        fields.push(field);
        values.push(value);
    };

    push('user_id', userId);
    push('name', account.name);
    push('email', account.email);
    push('category', account.category);
    push('location', account.location);
    push('phone', account.phone);
    push('is_approved', true);
    if (providerColumns.has('description')) push('description', account.bio);
    if (providerColumns.has('about')) push('about', account.bio);
    if (providerColumns.has('bio')) push('bio', account.bio);

    const placeholders = values.map((_, i) => `$${i + 1}`);
    const insertQuery = `INSERT INTO providers (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`;
    const inserted = await client.query(insertQuery, values);
    return inserted.rows[0].id;
}

async function run() {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const userColumns = await getColumns('users', client);
        const providerColumns = await getColumns('providers', client);

        for (const account of PROVIDERS) {
            const userId = await upsertUser(client, userColumns, account);
            const providerId = await upsertProvider(client, providerColumns, account, userId);
            console.log(`✅ Provider ready: ${account.email} (user=${userId}, provider=${providerId})`);
        }

        await client.query('COMMIT');
        console.log('✨ Non-Halan provider accounts seeded/updated successfully (6 accounts)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Non-Halan provider seeding failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end().catch(() => {});
    }
}

run();
