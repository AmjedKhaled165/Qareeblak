const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env.production' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://Qareeblak:Q%40r33bL%40k_StR0ng_%2126@qareeblak-serverdb.postgres.database.azure.com:5432/postgres?sslmode=require'
});

const accounts = [
    { name: 'حالا', username: 'halan', email: 'halan@halan.com', password: 'Halan#2026', type: 'owner', phone: '01012345678', location: '', description: '' },
    { name: 'حاتم', username: 'hatem', email: 'hatem@halan.com', password: 'Hatem#2026', type: 'partner_supervisor', phone: '01122334455', location: '', description: '' },
    { name: 'حسين', username: 'hussein', email: 'hussein@halan.com', password: 'Hussein#2026', type: 'partner_supervisor', phone: '01277889900', location: '', description: '' },
    { name: 'أشرف', username: 'ashraf', email: 'ashraf@halan.com', password: 'Ashraf#2026', type: 'partner_supervisor', phone: '01555667788', location: '', description: '' },
    { name: 'محمد', username: 'mohamed', email: 'mohamed@halan.com', password: 'Mohamed#2026', type: 'partner_supervisor', phone: '01099887766', location: '', description: '' },
    { name: 'عمر', username: 'omar', email: 'omar@courier.com', password: 'Omar#2026', type: 'partner_courier', phone: '01144556622', location: '', description: '' },
    { name: 'ياسين', username: 'yassin', email: 'yassin@courier.com', password: 'Yassin#2026', type: 'partner_courier', phone: '01288990011', location: '', description: '' },
    { name: 'حمزة', username: 'hamza', email: 'hamza@courier.com', password: 'Hamza@Ride2026', type: 'partner_courier', phone: '01066778899', location: '', description: '' },
    { name: 'زياد', username: 'ziad', email: 'ziad@courier.com', password: 'Ziad#2026', type: 'partner_courier', phone: '01500112233', location: '', description: '' },
    { name: 'سيف', username: 'seif', email: 'seif@courier.com', password: 'Seif#2026', type: 'partner_courier', phone: '01122112233', location: '', description: '' },
    { name: 'آدم', username: 'adam', email: 'adam@courier.com', password: 'Adam#2026', type: 'partner_courier', phone: '01233445566', location: '', description: '' },
    { name: 'يحيى', username: 'yehia', email: 'yehia@courier.com', password: 'Yehia#2026', type: 'partner_courier', phone: '01044332211', location: '', description: '' },
    { name: 'بلال', username: 'belal', email: 'belal@courier.com', password: 'Belal#2026', type: 'partner_courier', phone: '01555443322', location: '', description: '' },
    { name: 'أنس', username: 'anas', email: 'anas@courier.com', password: 'Anas#2026', type: 'partner_courier', phone: '01199880077', location: '', description: '' },
    { name: 'مروان', username: 'marwan', email: 'marwan@courier.com', password: 'Marwan#2026', type: 'partner_courier', phone: '01200998877', location: '', description: '' },
    { name: 'طارق حسن', username: 'tarek.food', email: 'tarek.food@example.com', password: 'TarekFood@2026!', type: 'provider', category: 'مطعم / كافيه', phone: '01011223344', location: 'الحي الأول، المجاورة الثانية، عمارة 15', description: 'تقديم أشهى المأكولات والمشروبات' },
    { name: 'مصطفى كمال', username: 'mostafa.maint', email: 'mostafa.maint@example.com', password: 'MostafaFix#99', type: 'provider', category: 'صيانة', phone: '01155667788', location: 'الحي الثاني، المجاورة الرابعة، محل 3', description: 'صيانة فورية لأعطال الكهرباء والسباكة' },
    { name: 'د. خالد عبدالرحمن', username: 'khaled.pharma', email: 'khaled.pharma@example.com', password: 'KhaledMed$2026', type: 'provider', category: 'طبي / صيدلية', phone: '01233445577', location: 'الحي الثالث، المجاورة الأولى، ميدان الزهور', description: 'صيدلية متكاملة وخدمات طبية' },
    { name: 'محمود جمال', username: 'mahmoud.cars', email: 'mahmoud.cars@example.com', password: 'CarsMahmoud*77', type: 'provider', category: 'خدمات سيارات', phone: '01555668899', location: 'المنطقة الصناعية، بلوك 4، ورشة 12', description: 'غسيل سيارات، تغيير زيوت، فحص دوري' },
    { name: 'إبراهيم سعيد', username: 'ibrahim.market', email: 'ibrahim.market@example.com', password: 'MarketIbra@26', type: 'provider', category: 'سوبر ماركت', phone: '01099887755', location: 'الحي الرابع، المجاورة الثالثة، السوق التجاري', description: 'توفير جميع السلع الغذائية والاستهلاكية' },
    { name: 'علي منصور', username: 'ali.laundry', email: 'ali.laundry@example.com', password: 'AliClean!2026', type: 'provider', category: 'أخرى - مغسلة', phone: '01122334477', location: 'الحي الخامس، سنتر المدينة، محل 5', description: 'غسيل، كي، وتنظيف سجاد' },
    { name: 'يوسف طارق', username: 'youssef.client', email: 'youssef.client@example.com', password: 'Youssef!2026', type: 'customer', phone: '01088774433', location: '', description: '' },
    { name: 'ندى إبراهيم', username: 'nada.customer', email: 'nada.customer@example.com', password: 'Nada#Buy26', type: 'customer', phone: '01155992211', location: '', description: '' },
    { name: 'مصطفى السيد', username: 'mostafa.user', email: 'mostafa.user@example.com', password: 'Mostafa$99', type: 'customer', phone: '01222334488', location: '', description: '' },
    { name: 'كابتن أحمد', username: 'ahmed.pitch', email: 'ahmed.pitch@example.com', password: 'AhmedPitch!2026', type: 'provider', category: 'ملاعب', phone: '01011223388', location: 'نادي النجوم، الحي السابع', description: 'حجز ملاعب خماسية مجهزة على أعلى مستوى' },
    { name: 'د. مصطفى', username: 'mostafa.doc', email: 'mostafa.doc@example.com', password: 'MostafaDoc!2026', type: 'provider', category: 'دكتور وممرض', phone: '01122334499', location: 'عيادات الشفاء، المجاورة الثانية', description: 'كشوفات طبية وتمريض منزلي على مدار الساعة' },
    { name: 'علي للتوصيل', username: 'ali.delivery', email: 'ali.delivery@example.com', password: 'AliDelivery!2026', type: 'provider', category: 'سيارات توصيل', phone: '01233445500', location: 'موقف السيارات الرئيسي', description: 'توصيل أفراد ومشاوير خاصة بسيارات حديثة' }
];

async function seed() {
    console.log('Starting seed process...');
    for (const acc of accounts) {
        try {
            const check = await pool.query('SELECT id FROM users WHERE email = $1', [acc.email]);
            if (check.rows.length > 0) {
                console.log(`User ${acc.email} already exists, skipping.`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(acc.password, 10);
            const userRes = await pool.query(
                `INSERT INTO users (name, username, email, password, phone, user_type)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [acc.name, acc.username, acc.email, hashedPassword, acc.phone, acc.type]
            );

            const userId = userRes.rows[0].id;

            if (acc.type === 'provider') {
                await pool.query(
                    `INSERT INTO providers (user_id, name, email, category, location, phone, is_approved)
                     VALUES ($1, $2, $3, $4, $5, $6, true)`,
                    [userId, acc.name, acc.email, acc.category, acc.location, acc.phone]
                );
            }

            console.log(`Successfully created: ${acc.email} (${acc.type})`);
        } catch (error) {
            console.error(`Error creating ${acc.email}:`, error.message);
        }
    }
    console.log('Seed complete.');
    pool.end();
}

seed();
