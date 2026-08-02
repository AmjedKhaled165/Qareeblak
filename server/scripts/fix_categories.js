require('dotenv').config();
const pool = require('../db');

async function fixCategories() {
  try {
    console.log("Updating categories to match frontend tabs...");
    await pool.query(`
      UPDATE providers SET category = 'صيانة وسباكة' WHERE category = 'صيانة';
      UPDATE providers SET category = 'مطاعم وكافيهات' WHERE category = 'مطاعم';
      UPDATE providers SET category = 'صيدليات' WHERE category = 'طبي' AND email = 'khaled.pharma@example.com';
      UPDATE providers SET category = 'دكتور وممرض' WHERE category = 'طبي' AND email = 'mostafa.doc@example.com';
      UPDATE providers SET category = 'خدمات سيارات' WHERE category = 'سيارات';
      
      -- Let's just fix any others if needed
      UPDATE providers SET category = 'ملاعب' WHERE category = 'ملاعب';
      UPDATE providers SET category = 'سوبر ماركت' WHERE category = 'سوبر ماركت';
      UPDATE providers SET category = 'مغسلة' WHERE category = 'مغسلة';
      UPDATE providers SET category = 'سيارات توصيل' WHERE category = 'سيارات توصيل';
    `);
    console.log("Categories updated successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fixCategories();
