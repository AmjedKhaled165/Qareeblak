require('dotenv').config();
const db = require('../db');
const { client: redisClient, connectRedis } = require('../utils/redis');
const bookingService = require('../services/booking.service');
const logger = require('../utils/logger');

// Temporarily suppress typical logs for clean output
const originalInfo = logger.info;
logger.info = () => { };

async function runStressTest() {
    console.log('🚀 بدء الفحص الشامل للضغط (Stress & Concurrency Test)...');

    // Connect to Redis for Idempotency
    await connectRedis();

    // 1. Setup Test Data (Provider, Service, User)
    const client = await db.pool.connect();
    let providerId, userId, prizeId;

    try {
        console.log('⏳ تجهيز بيئة الاختبار (حسابات مزيفة)...');
        // Clean previous test data
        await client.query("DELETE FROM users WHERE email LIKE 'test_stress_%'");

        // Insert User
        const userRes = await client.query(`
            INSERT INTO users (name, phone, email, password, user_type) 
            VALUES ('Stress User', '01000000000', 'test_stress_user@qareeblak.com', 'pwd', 'user') RETURNING id;
        `);
        userId = userRes.rows[0].id;

        // Insert Provider
        const providerUserRes = await client.query(`
            INSERT INTO users (name, phone, email, password, user_type) 
            VALUES ('Stress Provider', '01000000001', 'test_stress_prov@qareeblak.com', 'pwd', 'provider') RETURNING id;
        `);
        const providerRes = await client.query(`
            INSERT INTO providers (name, description, category, user_id) 
            VALUES ('مطعم الضغط العالي', 'Test', 'clinic', $1) RETURNING id;
        `, [providerUserRes.rows[0].id]);
        providerId = providerRes.rows[0].id;

        // Insert Prize (100% Discount)
        const wheelPrizeRes = await client.query(`
            INSERT INTO wheel_prizes (name, prize_type, prize_value, probability, provider_id)
            VALUES ('Test Free Order', 'discount_percent', 100, 10, $1) RETURNING id;
        `, [providerId]);

        const userPrizeRes = await client.query(`
            INSERT INTO user_prizes (user_id, prize_id, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '1 day') RETURNING id;
        `, [userId, wheelPrizeRes.rows[0].id]);
        prizeId = userPrizeRes.rows[0].id;

        console.log('✅ بيئة الاختبار جاهزة.');
    } catch (e) {
        console.error('❌ خطأ في تجهيز البيانات', e);
        process.exit(1);
    } finally {
        client.release();
    }

    const orderItems = [{
        providerId: providerId,
        providerName: 'مطعم الضغط العالي',
        price: 500, // Price
        quantity: 1,
        name: 'خدمة اختبار'
    }];
    const address = { phone: '123', area: 'Test', details: 'Details' };

    // ============================================
    // SCENARIO 1: IDEMPOTENCY TEST (Button Spamming)
    // ============================================
    console.log('\n--- سيناريو 1: العميل ضغط على زر الدفع 10 مرات متتالية في نفس اللحظة (Idempotency Test) ---');
    const idempotencyKey = `STRESS_TEST_KEY_${Date.now()}`;

    const clickPromises = [];
    for (let i = 0; i < 10; i++) {
        clickPromises.push(bookingService.checkoutTransaction(userId, orderItems, address, null, idempotencyKey));
    }

    try {
        const results = await Promise.all(clickPromises);

        // Check if all results have the SAME parentOrder ID
        const parentIds = results.map(r => r.parentId);
        const allSame = parentIds.every(id => id === parentIds[0]);

        console.log(`✅ النتيجة: تم استقبال 10 طلبات في نفس الميلي ثانية.`);
        console.log(`✅ هل تم الاستجابة من الكاش (Redis) ومنع تكرار الخصم من الرصيد وعمل اوردرات مكررة؟ ${allSame ? 'نعم (ناجح) 🛡️' : 'لا (فشل)'}`);
        console.log(`📌 معرَّف الطلب الذي تم تنفيذه مرة واحدة فقط: ${parentIds[0]}`);
    } catch (e) {
        console.error('❌ فشل Idempotency:', e.message);
    }

    // ============================================
    // SCENARIO 2: RACE CONDITION TEST (Prize Exploitation)
    // ============================================
    console.log('\n--- سيناريو 2: العميل أرسل طلبين باستخدام نفس الكوبون / الهدية في نفس اللحظة بـ Keys مختلفة (Race Condition Test) ---');
    // We will bypass idempotency by giving them different keys, but using the same single prizeId

    const racePromises = [];
    for (let i = 0; i < 5; i++) {
        racePromises.push(
            bookingService.checkoutTransaction(userId, orderItems, address, prizeId, `RACE_KEY_${Date.now()}_${i}`)
                .catch(e => ({ error: e.message })) // Catch errors so Promise.all doesn't fail fast
        );
    }

    const raceResults = await Promise.all(racePromises);

    let successCountWithPrize = 0;
    let fallbackCountNoPrize = 0;

    raceResults.forEach((res, index) => {
        if (!res.error) {
            // Did it use the prize? (Total should be 500, if prize used discount is 500)
            if (res.discount === 500) {
                successCountWithPrize++;
            } else {
                fallbackCountNoPrize++;
            }
        }
    });

    console.log(`✅ النتيجة: تم إرسال 5 اختراقات لاستغلال نفس الخصم مراراً.`);
    console.log(`✅ الطلبات التي نجحت بخصم 100%: ${successCountWithPrize} (يجب أن يكون 1 فقط) 🛡️`);
    console.log(`✅ الطلبات التي مرت ولكن بدون الخصم (لأن القفل منعها): ${fallbackCountNoPrize}`);

    if (successCountWithPrize === 1) {
        console.log('✅ نجاح مبهر: نظام (FOR UPDATE) بقاعدة البيانات سحق الـ Race Condition تماماً.');
    } else {
        console.log('❌ تحذير: فشل في حماية قاعدة البيانات من الـ Race Condition.');
    }

    // Clean up
    console.log('\n🧹 جاري تنظيف داتا الاختبار و إغلاق الاتصالات...');
    await db.query(`DELETE FROM users WHERE email LIKE 'test_stress_%'`);
    await db.end();
    if (redisClient.status === 'ready') await redisClient.quit();
    console.log('👋 انتهاء فحص المهندسين!');
}

runStressTest();
