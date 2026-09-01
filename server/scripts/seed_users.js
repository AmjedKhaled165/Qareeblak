require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../db');
const bcrypt = require('bcryptjs');

const usersToSeed = [
    { name: 'حالا', username: 'halan', email: 'halan@halan.com', password: 'Halan#2026', typeAr: 'المالك', phone: '01012345678', address: '-', services: '-' },
    { name: 'حاتم', username: 'hatem', email: 'hatem@halan.com', password: 'Hatem#2026', typeAr: 'مسؤول', phone: '01122334455', address: '-', services: '-' },
    { name: 'حسين', username: 'hussein', email: 'hussein@halan.com', password: 'Hussein#2026', typeAr: 'مسؤول', phone: '01277889900', address: '-', services: '-' },
    { name: 'أشرف', username: 'ashraf', email: 'ashraf@halan.com', password: 'Ashraf#2026', typeAr: 'مسؤول', phone: '01555667788', address: '-', services: '-' },
    { name: 'محمد', username: 'mohamed', email: 'mohamed@halan.com', password: 'Mohamed#2026', typeAr: 'مسؤول', phone: '01099887766', address: '-', services: '-' },
    { name: 'عمر', username: 'omar', email: 'omar@courier.com', password: 'Omar#2026', typeAr: 'مندوب', phone: '01144556622', address: '-', services: '-' },
    { name: 'ياسين', username: 'yassin', email: 'yassin@courier.com', password: 'Yassin#2026', typeAr: 'مندوب', phone: '01288990011', address: '-', services: '-' },
    { name: 'حمزة', username: 'hamza', email: 'hamza@courier.com', password: 'Hamza@Ride2026', typeAr: 'مندوب', phone: '01066778899', address: '-', services: '-' },
    { name: 'زياد', username: 'ziad', email: 'ziad@courier.com', password: 'Ziad#2026', typeAr: 'مندوب', phone: '01500112233', address: '-', services: '-' },
    { name: 'سيف', username: 'seif', email: 'seif@courier.com', password: 'Seif#2026', typeAr: 'مندوب', phone: '01122112233', address: '-', services: '-' },
    { name: 'آدم', username: 'adam', email: 'adam@courier.com', password: 'Adam#2026', typeAr: 'مندوب', phone: '01233445566', address: '-', services: '-' },
    { name: 'يحيى', username: 'yehia', email: 'yehia@courier.com', password: 'Yehia#2026', typeAr: 'مندوب', phone: '01044332211', address: '-', services: '-' },
    { name: 'بلال', username: 'belal', email: 'belal@courier.com', password: 'Belal#2026', typeAr: 'مندوب', phone: '01555443322', address: '-', services: '-' },
    { name: 'أنس', username: 'anas', email: 'anas@courier.com', password: 'Anas#2026', typeAr: 'مندوب', phone: '01199880077', address: '-', services: '-' },
    { name: 'مروان', username: 'marwan', email: 'marwan@courier.com', password: 'Marwan#2026', typeAr: 'مندوب', phone: '01200998877', address: '-', services: '-' },
    { name: 'طارق حسن', username: 'tarek.food', email: 'tarek.food@example.com', password: 'TarekFood@2026!', typeAr: 'مزود (مطعم / كافيه)', phone: '01011223344', address: 'الحي الأول، المجاورة الثانية، عمارة 15', services: 'تقديم أشهى المأكولات والمشروبات' },
    { name: 'مصطفى كمال', username: 'mostafa.maint', email: 'mostafa.maint@example.com', password: 'MostafaFix#99', typeAr: 'مزود (صيانة)', phone: '01155667788', address: 'الحي الثاني، المجاورة الرابعة، محل 3', services: 'صيانة فورية لأعطال الكهرباء والسباكة' },
    { name: 'د. خالد عبدالرحمن', username: 'khaled.pharma', email: 'khaled.pharma@example.com', password: 'KhaledMed$2026', typeAr: 'مزود (طبي / صيدلية)', phone: '01233445577', address: 'الحي الثالث، المجاورة الأولى، ميدان الزهور', services: 'صيدلية متكاملة وخدمات طبية' },
    { name: 'محمود جمال', username: 'mahmoud.cars', email: 'mahmoud.cars@example.com', password: 'CarsMahmoud*77', typeAr: 'مزود (خدمات سيارات)', phone: '01555668899', address: 'المنطقة الصناعية، بلوك 4، ورشة 12', services: 'غسيل سيارات، تغيير زيوت، فحص دوري' },
    { name: 'إبراهيم سعيد', username: 'ibrahim.market', email: 'ibrahim.market@example.com', password: 'MarketIbra@26', typeAr: 'مزود (سوبر ماركت)', phone: '01099887755', address: 'الحي الرابع، المجاورة الثالثة، السوق التجاري', services: 'توفير جميع السلع الغذائية والاستهلاكية' },
    { name: 'علي منصور', username: 'ali.laundry', email: 'ali.laundry@example.com', password: 'AliClean!2026', typeAr: 'مزود (أخرى - مغسلة)', phone: '01122334477', address: 'الحي الخامس، سنتر المدينة، محل 5', services: 'غسيل، كي، وتنظيف سجاد' },
    { name: 'يوسف طارق', username: 'youssef.client', email: 'youssef.client@example.com', password: 'Youssef!2026', typeAr: 'عميل', phone: '01088774433', address: '-', services: '-' },
    { name: 'ندى إبراهيم', username: 'nada.customer', email: 'nada.customer@example.com', password: 'Nada#Buy26', typeAr: 'عميل', phone: '01155992211', address: '-', services: '-' },
    { name: 'مصطفى السيد', username: 'mostafa.user', email: 'mostafa.user@example.com', password: 'Mostafa$99', typeAr: 'عميل', phone: '01222334488', address: '-', services: '-' },
];

function mapUserType(typeAr) {
    if (typeAr === 'المالك') return 'partner_owner';
    if (typeAr === 'مسؤول') return 'partner_supervisor';
    if (typeAr === 'مندوب') return 'partner_courier';
    if (typeAr.startsWith('مزود')) return 'provider';
    if (typeAr === 'عميل') return 'customer';
    return 'customer'; // fallback
}

function extractProviderCategory(typeAr) {
    if (typeAr === 'مزود (مطعم / كافيه)') return 'مطاعم وكافيهات';
    if (typeAr === 'مزود (صيانة)') return 'صيانة عامة';
    if (typeAr === 'مزود (طبي / صيدلية)') return 'طب وصيدلة';
    if (typeAr === 'مزود (خدمات سيارات)') return 'خدمات سيارات';
    if (typeAr === 'مزود (سوبر ماركت)') return 'سوبر ماركت ومقاضي';
    if (typeAr === 'مزود (أخرى - مغسلة)') return 'مغاسل وتنظيف';
    return 'أخرى';
}

async function seed() {
    console.log('Starting DB seeding process...');

    try {
        await pool.query('BEGIN');

        for (const user of usersToSeed) {
            console.log(`Processing user: ${user.email}...`);

            // Check if user exists
            const existing = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
            let userId;

            const userType = mapUserType(user.typeAr);
            const hashedPassword = await bcrypt.hash(user.password, 12);

            if (existing.rows.length > 0) {
                console.log(`User ${user.email} already exists. Updating details...`);
                userId = existing.rows[0].id;
                await pool.query(
                    `UPDATE users SET name = $1, username = $2, password = $3, user_type = $4, phone = $5 WHERE id = $6`,
                    [user.name, user.username, hashedPassword, userType, user.phone, userId]
                );
            } else {
                console.log(`Creating new user ${user.email}...`);
                // Assume schema has username field
                const insertRes = await pool.query(
                    `INSERT INTO users (name, username, email, password, user_type, phone)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                    [user.name, user.username, user.email, hashedPassword, userType, user.phone]
                );
                userId = insertRes.rows[0].id;
            }

            // If it's a provider, manage the provider row
            if (userType === 'provider') {
                const category = extractProviderCategory(user.typeAr);
                const existingProvider = await pool.query('SELECT id FROM providers WHERE user_id = $1', [userId]);

                if (existingProvider.rows.length === 0) {
                    console.log(`Creating provider profile for ${user.email}...`);
                    const providerRes = await pool.query(
                        `INSERT INTO providers (user_id, name, email, category, location, phone)
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                        [userId, user.name, user.email, category, user.address !== '-' ? user.address : '', user.phone]
                    );

                    // Skipping services insert to avoid schema mismatch issues with description column
                    console.log(`Provider profile created.`);
                } else {
                     console.log(`Provider profile already exists for ${user.email}.`);
                }
            }
        }

        await pool.query('COMMIT');
        console.log('Seeding completed successfully!');
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Error seeding database:', err);
    } finally {
        pool.end();
    }
}

seed();
