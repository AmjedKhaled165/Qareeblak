require('dotenv').config();
const pool = require('../db');
const bcrypt = require('bcryptjs');

const usersData = [
  { name: 'حالا', username: 'halan', email: 'halan@halan.com', password: 'Halan#2026', type: 'partner_owner', phone: '01012345678', address: null, bio: null, category: null },
  { name: 'حاتم', username: 'hatem', email: 'hatem@halan.com', password: 'Hatem#2026', type: 'partner_supervisor', phone: '01122334455', address: null, bio: null, category: null },
  { name: 'حسين', username: 'hussein', email: 'hussein@halan.com', password: 'Hussein#2026', type: 'partner_supervisor', phone: '01277889900', address: null, bio: null, category: null },
  { name: 'أشرف', username: 'ashraf', email: 'ashraf@halan.com', password: 'Ashraf#2026', type: 'partner_supervisor', phone: '01555667788', address: null, bio: null, category: null },
  { name: 'محمد', username: 'mohamed', email: 'mohamed@halan.com', password: 'Mohamed#2026', type: 'partner_supervisor', phone: '01099887766', address: null, bio: null, category: null },
  { name: 'عمر', username: 'omar', email: 'omar@courier.com', password: 'Omar#2026', type: 'partner_courier', phone: '01144556622', address: null, bio: null, category: null },
  { name: 'ياسين', username: 'yassin', email: 'yassin@courier.com', password: 'Yassin#2026', type: 'partner_courier', phone: '01288990011', address: null, bio: null, category: null },
  { name: 'حمزة', username: 'hamza', email: 'hamza@courier.com', password: 'Hamza@Ride2026', type: 'partner_courier', phone: '01066778899', address: null, bio: null, category: null },
  { name: 'زياد', username: 'ziad', email: 'ziad@courier.com', password: 'Ziad#2026', type: 'partner_courier', phone: '01500112233', address: null, bio: null, category: null },
  { name: 'سيف', username: 'seif', email: 'seif@courier.com', password: 'Seif#2026', type: 'partner_courier', phone: '01122112233', address: null, bio: null, category: null },
  { name: 'آدم', username: 'adam', email: 'adam@courier.com', password: 'Adam#2026', type: 'partner_courier', phone: '01233445566', address: null, bio: null, category: null },
  { name: 'يحيى', username: 'yehia', email: 'yehia@courier.com', password: 'Yehia#2026', type: 'partner_courier', phone: '01044332211', address: null, bio: null, category: null },
  { name: 'بلال', username: 'belal', email: 'belal@courier.com', password: 'Belal#2026', type: 'partner_courier', phone: '01555443322', address: null, bio: null, category: null },
  { name: 'أنس', username: 'anas', email: 'anas@courier.com', password: 'Anas#2026', type: 'partner_courier', phone: '01199880077', address: null, bio: null, category: null },
  { name: 'مروان', username: 'marwan', email: 'marwan@courier.com', password: 'Marwan#2026', type: 'partner_courier', phone: '01200998877', address: null, bio: null, category: null },
  { name: 'طارق حسن', username: 'tarek.food', email: 'tarek.food@example.com', password: 'TarekFood@2026!', type: 'provider', phone: '01011223344', address: 'الحي الأول، المجاورة الثانية، عمارة 15', bio: 'تقديم أشهى المأكولات والمشروبات', category: 'مطاعم' },
  { name: 'مصطفى كمال', username: 'mostafa.maint', email: 'mostafa.maint@example.com', password: 'MostafaFix#99', type: 'provider', phone: '01155667788', address: 'الحي الثاني، المجاورة الرابعة، محل 3', bio: 'صيانة فورية لأعطال الكهرباء والسباكة', category: 'صيانة' },
  { name: 'د. خالد عبدالرحمن', username: 'khaled.pharma', email: 'khaled.pharma@example.com', password: 'KhaledMed$2026', type: 'provider', phone: '01233445577', address: 'الحي الثالث، المجاورة الأولى، ميدان الزهور', bio: 'صيدلية متكاملة وخدمات طبية', category: 'طبي' },
  { name: 'محمود جمال', username: 'mahmoud.cars', email: 'mahmoud.cars@example.com', password: 'CarsMahmoud*77', type: 'provider', phone: '01555668899', address: 'المنطقة الصناعية، بلوك 4، ورشة 12', bio: 'غسيل سيارات، تغيير زيوت، فحص دوري', category: 'سيارات' },
  { name: 'إبراهيم سعيد', username: 'ibrahim.market', email: 'ibrahim.market@example.com', password: 'MarketIbra@26', type: 'provider', phone: '01099887755', address: 'الحي الرابع، المجاورة الثالثة، السوق التجاري', bio: 'توفير جميع السلع الغذائية والاستهلاكية', category: 'سوبر ماركت' },
  { name: 'علي منصور', username: 'ali.laundry', email: 'ali.laundry@example.com', password: 'AliClean!2026', type: 'provider', phone: '01122334477', address: 'الحي الخامس، سنتر المدينة، محل 5', bio: 'غسيل، كي، وتنظيف سجاد', category: 'مغسلة' },
  { name: 'يوسف طارق', username: 'youssef.client', email: 'youssef.client@example.com', password: 'Youssef!2026', type: 'customer', phone: '01088774433', address: null, bio: null, category: null },
  { name: 'ندى إبراهيم', username: 'nada.customer', email: 'nada.customer@example.com', password: 'Nada#Buy26', type: 'customer', phone: '01155992211', address: null, bio: null, category: null },
  { name: 'مصطفى السيد', username: 'mostafa.user', email: 'mostafa.user@example.com', password: 'Mostafa$99', type: 'customer', phone: '01222334488', address: null, bio: null, category: null },
  { name: 'كابتن أحمد', username: 'ahmed.pitch', email: 'ahmed.pitch@example.com', password: 'AhmedPitch!2026', type: 'provider', phone: '01011223388', address: 'نادي النجوم، الحي السابع', bio: 'حجز ملاعب خماسية مجهزة على أعلى مستوى', category: 'ملاعب' },
  { name: 'د. مصطفى', username: 'mostafa.doc', email: 'mostafa.doc@example.com', password: 'MostafaDoc!2026', type: 'provider', phone: '01122334499', address: 'عيادات الشفاء، المجاورة الثانية', bio: 'كشوفات طبية وتمريض منزلي على مدار الساعة', category: 'طبي' },
  { name: 'علي للتوصيل', username: 'ali.delivery', email: 'ali.delivery@example.com', password: 'AliDelivery!2026', type: 'provider', phone: '01233445500', address: 'موقف السيارات الرئيسي', bio: 'توصيل أفراد ومشاوير خاصة بسيارات حديثة', category: 'سيارات توصيل' }
];

async function run() {
  try {
    // 1. Update Database Schema to support profile/brand modifications cleanly
    console.log("Altering schema to add flexible columns...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);
    `);
    
    await pool.query(`
      ALTER TABLE providers 
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);
    `);
    
    console.log("Schema updated successfully.");

    // 2. Insert Users
    for (const user of usersData) {
      console.log(`Processing ${user.name}...`);
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);

      // Upsert User
      const userResult = await pool.query(`
        INSERT INTO users (name, username, email, password, phone, user_type, address, bio) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email) DO UPDATE 
        SET 
          name = EXCLUDED.name,
          username = EXCLUDED.username,
          password = EXCLUDED.password,
          phone = EXCLUDED.phone,
          user_type = EXCLUDED.user_type,
          address = EXCLUDED.address,
          bio = EXCLUDED.bio
        RETURNING id;
      `, [
        user.name, 
        user.username, 
        user.email, 
        hashedPassword, 
        user.phone, 
        user.type, 
        user.address, 
        user.bio
      ]);

      const userId = userResult.rows[0].id;
      console.log(`User ${user.name} inserted with ID ${userId}`);

      // If Provider, Upsert into providers table
      if (user.type === 'provider') {
        const checkProvider = await pool.query('SELECT id FROM providers WHERE user_id = $1', [userId]);
        
        if (checkProvider.rows.length > 0) {
          // Update
          await pool.query(`
            UPDATE providers SET
              name = $2, email = $3, category = $4, location = $5, phone = $6, bio = $7, address = $8
            WHERE user_id = $1
          `, [
            userId, user.name, user.email, user.category, user.address, user.phone, user.bio, user.address
          ]);
        } else {
          // Insert
          await pool.query(`
            INSERT INTO providers (user_id, name, email, category, location, phone, bio, address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            userId, user.name, user.email, user.category, user.address, user.phone, user.bio, user.address
          ]);
        }
        console.log(`Provider profile for ${user.name} updated.`);
      }
    }
    
    console.log("All users added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
