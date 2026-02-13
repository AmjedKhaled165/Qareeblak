const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:qareeblak123@127.0.0.1:5432/qareeblak'
});

async function fixUsername() {
    try {
        console.log('🔧 جاري إصلاح اسم المستخدم...');
        
        // Update the NULL username for user ID=5
        const result = await pool.query(
            `UPDATE users 
             SET username = 'amjed-owner' 
             WHERE id = 5 AND username IS NULL 
             RETURNING id, username, name, user_type`
        );

        if (result.rowCount > 0) {
            console.log('✅ تم الإصلاح بنجاح!');
            console.log('📋 البيانات المحدثة:');
            console.log(result.rows[0]);
            console.log('\n🔑 بيانات تسجيل الدخول:');
            console.log('   اسم المستخدم: amjed-owner');
            console.log('   كلمة المرور: 123456');
        } else {
            console.log('⚠️  لم يتم العثور على سجل يحتاج للتحديث');
        }

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await pool.end();
    }
}

fixUsername();
