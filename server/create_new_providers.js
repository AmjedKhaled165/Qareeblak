const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: 'postgresql://Qareeblak:Q%40r33bL%40k_StR0ng_%2126@qareeblak-serverdb.postgres.database.azure.com:5432/postgres?sslmode=require'
});

const newProviders = [
    {
        name: 'كابتن أحمد',
        username: 'ahmed.pitch',
        email: 'ahmed.pitch@example.com',
        password: 'AhmedPitch!2026',
        category: 'ملاعب',
        phone: '01011223388',
        location: 'نادي النجوم، الحي السابع',
        description: 'حجز ملاعب خماسية مجهزة على أعلى مستوى'
    },
    {
        name: 'د. مصطفى',
        username: 'mostafa.doc',
        email: 'mostafa.doc@example.com',
        password: 'MostafaDoc!2026',
        category: 'دكتور وممرض',
        phone: '01122334499',
        location: 'عيادات الشفاء، المجاورة الثانية',
        description: 'كشوفات طبية وتمريض منزلي على مدار الساعة'
    },
    {
        name: 'علي للتوصيل',
        username: 'ali.delivery',
        email: 'ali.delivery@example.com',
        password: 'AliDelivery!2026',
        category: 'سيارات توصيل',
        phone: '01233445500',
        location: 'موقف السيارات الرئيسي',
        description: 'توصيل أفراد ومشاوير خاصة بسيارات حديثة'
    }
];

async function createAccounts() {
    for (const p of newProviders) {
        try {
            // Check if user already exists
            const existing = await pool.query('SELECT id FROM users WHERE email = $1', [p.email]);
            if (existing.rows.length > 0) {
                console.log(`User ${p.email} already exists.`);
                continue;
            }

            // Insert User
            const hashedPassword = await bcrypt.hash(p.password, 10);
            const userRes = await pool.query(
                `INSERT INTO users (name, username, email, password, phone, user_type) 
                 VALUES ($1, $2, $3, $4, $5, 'provider') RETURNING id`,
                [p.name, p.username, p.email, hashedPassword, p.phone]
            );
            const userId = userRes.rows[0].id;

            // Insert Provider
            await pool.query(
                `INSERT INTO providers (user_id, name, email, category, location, phone, is_approved) 
                 VALUES ($1, $2, $3, $4, $5, $6, true)`,
                [userId, p.name, p.email, p.category, p.location, p.phone]
            );
            
            console.log(`Created provider: ${p.name}`);
        } catch (error) {
            console.error(`Error creating ${p.name}:`, error.message);
        }
    }
    pool.end();
}

createAccounts();
