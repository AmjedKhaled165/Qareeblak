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

    // Run migrations to ensure database state is correct
    console.log('🔄 Running database migrations...');
    const runStartupMigrations = require('../migrations/startup');
    const runFinanceMigrations = require('../migrations/finance_and_fraud');
    await runStartupMigrations();
    await runFinanceMigrations();

    // 1. Setup Test Data (Provider, Service, User)
    const client = await db.connect();
    let providerId, userId, prizeId;

    try {
        console.log('⏳ تجهيز بيئة الاختبار (حسابات مزيفة)...');
        // Clean previous test data
        await client.query("DELETE FROM bookings WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_stress_%')");
        await client.query("DELETE FROM delivery_orders WHERE customer_id IN (SELECT id FROM users WHERE email LIKE 'test_stress_%')");
        await client.query("DELETE FROM parent_orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_stress_%')");
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
            INSERT INTO providers (name, category, email, user_id) 
            VALUES ('مطعم الضغط العالي', 'clinic', 'stress_prov@qareeblak.com', $1) RETURNING id;
        `, [providerUserRes.rows[0].id]);
        providerId = providerRes.rows[0].id;

        // Insert Prize (100% Discount)
        const wheelPrizeRes = await client.query(`
            INSERT INTO wheel_prizes (name, prize_type, prize_value, probability, provider_id)
            VALUES ('Test Free Order', 'discount_percent', 100, 10, $1) RETURNING id;
        `, [providerId]);

        const userPrizeRes = await client.query(`
            INSERT INTO user_prizes (user_id, prize_id)
            VALUES ($1, $2) RETURNING id;
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
        clickPromises.push(
            bookingService.checkoutTransaction(userId, orderItems, address, { idempotencyKey })
            .catch(e => ({ error: e.message }))
        );
    }

    try {
        const results = await Promise.all(clickPromises);
        const successes = results.filter(r => !r.error);
        const errors = results.filter(r => r.error);

        console.log(`✅ النتيجة: تم استقبال 10 طلبات في نفس الميلي ثانية.`);
        console.log(`✅ عدد الطلبات الناجحة: ${successes.length}`);
        console.log(`✅ عدد الأخطاء (PROCESS_IN_PROGRESS): ${errors.length}`);
        if (errors.length > 0) {
            console.log(`📌 عينة من الأخطاء: ${errors[0].error}`);
        }
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
            bookingService.checkoutTransaction(userId, orderItems, address, {
                userPrizeId: prizeId,
                idempotencyKey: `RACE_KEY_${Date.now()}_${i}`
            })
            .catch(e => ({ error: e.message })) // Catch errors so Promise.all doesn't fail fast
        );
    }

    const raceResults = await Promise.all(racePromises);

    let successCountWithPrize = 0;
    let fallbackCountNoPrize = 0;

    raceResults.forEach((res, index) => {
        if (!res.error) {
            // Did it use the prize? (If prize used, finalPrice is 0. Else it is 500)
            if (res.finalPrice === 0) {
                successCountWithPrize++;
            } else {
                fallbackCountNoPrize++;
            }
        } else {
            console.log(`❌ خطأ في المعاملة رقم ${index}: ${res.error}`);
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

    // ============================================
    // SCENARIO 3: PRICE TAMPERING ATTACK
    // ============================================
    console.log('\n--- سيناريو 3: هجوم التلاعب بالأسعار (Price Tampering Attack) ---');
    console.log('📌 يرسل العميل طلب بسعر 1 جنيه بدلاً من 500 جنيه (السعر الحقيقي في قاعدة البيانات)');

    // Create a service with a known price
    const serviceRes = await db.query(
        `INSERT INTO services (provider_id, name, price) VALUES ($1, 'خدمة سعرها 500', 500) RETURNING id`,
        [providerId]
    );
    const serviceId = serviceRes.rows[0].id;

    const tamperedItems = [{
        id: serviceId,
        providerId: providerId,
        providerName: 'مطعم الضغط العالي',
        price: 1,  // ← TAMPERED: Attacker sends 1 instead of 500
        quantity: 1,
        name: 'خدمة سعرها 500'
    }];

    try {
        const tamperResult = await bookingService.checkoutTransaction(
            userId, tamperedItems, address,
            { idempotencyKey: `TAMPER_TEST_${Date.now()}` }
        );

        if (tamperResult.finalPrice >= 500) {
            console.log(`✅ نجاح: نظام Zero-Trust أعاد السعر إلى ${tamperResult.finalPrice} ج.م (تم تجاهل السعر المزيف 1 ج.م)`);
        } else {
            console.log(`❌ فشل خطير: نظام التسعير قبل السعر المزيف! السعر النهائي: ${tamperResult.finalPrice} ج.م`);
        }
    } catch (e) {
        // If it threw an error, that's also acceptable (strict rejection mode)
        console.log(`✅ نجاح (رفض صريح): ${e.message}`);
    }

    // Test with a completely fake service ID
    console.log('📌 يرسل العميل طلب بمعرف خدمة غير موجود (ID مزيف)');
    const fakeItems = [{
        id: 999999,
        providerId: providerId,
        providerName: 'مطعم الضغط العالي',
        price: 1,
        quantity: 1,
        name: 'خدمة وهمية'
    }];

    try {
        await bookingService.checkoutTransaction(
            userId, fakeItems, address,
            { idempotencyKey: `FAKE_ID_TEST_${Date.now()}` }
        );
        console.log('❌ فشل: النظام قبل خدمة بمعرف وهمي!');
    } catch (e) {
        console.log(`✅ نجاح: النظام رفض الخدمة الوهمية — ${e.message}`);
    }

    // ============================================
    // SCENARIO 4: PROMO CODE RACE CONDITION
    // ============================================
    console.log('\n--- سيناريو 4: استغلال كود خصم محدود الاستخدام (Promo Code Race Condition) ---');
    
    // Insert a single-use promo code
    await db.query(
        `INSERT INTO promo_codes (code, discount_type, discount_value, usage_limit, usage_count, is_active)
         VALUES ('TESTONCE', 'percentage', 50, 1, 0, TRUE)
         ON CONFLICT (code) DO UPDATE SET usage_count = 0, usage_limit = 1, is_active = TRUE`
    );

    const validItems = [{
        id: serviceId,
        providerId: providerId,
        providerName: 'مطعم الضغط العالي',
        price: 500,
        quantity: 1,
        name: 'خدمة سعرها 500'
    }];

    const promoPromises = [];
    for (let i = 0; i < 5; i++) {
        promoPromises.push(
            bookingService.checkoutTransaction(userId, validItems, address, {
                promoCode: 'TESTONCE',
                idempotencyKey: `PROMO_RACE_${Date.now()}_${i}`
            })
            .catch(e => ({ error: e.message }))
        );
    }

    const promoResults = await Promise.all(promoPromises);
    let promoSuccessCount = 0;
    let promoBlockedCount = 0;
    promoResults.forEach((res) => {
        if (!res.error) {
            promoSuccessCount++;
        } else {
            promoBlockedCount++;
        }
    });

    console.log(`✅ النتيجة: تم إرسال 5 طلبات متزامنة بنفس الكود المحدود.`);
    console.log(`✅ الطلبات التي نجحت بالكود: ${promoSuccessCount} (يجب أن يكون 1 أو أقل)`);
    console.log(`✅ الطلبات التي رُفضت: ${promoBlockedCount}`);

    if (promoSuccessCount <= 1) {
        console.log('✅ نجاح: نظام FOR UPDATE حمى الكود من الاستغلال المتكرر.');
    } else {
        console.log('❌ تحذير: تم استخدام الكود أكثر من مرة — Race Condition محتمل.');
    }

    // Clean up
    console.log('\n🧹 جاري تنظيف داتا الاختبار و إغلاق الاتصالات...');
    await db.query("DELETE FROM bookings WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_stress_%')");
    await db.query("DELETE FROM delivery_orders WHERE customer_id IN (SELECT id FROM users WHERE email LIKE 'test_stress_%')");
    await db.query("DELETE FROM parent_orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_stress_%')");
    await db.query("DELETE FROM promo_codes WHERE code = 'TESTONCE'");
    await db.query("DELETE FROM users WHERE email LIKE 'test_stress_%'");
    await db.end();
    if (redisClient.status === 'ready') await redisClient.quit();
    console.log('👋 انتهاء فحص المهندسين!');
}

runStressTest();

