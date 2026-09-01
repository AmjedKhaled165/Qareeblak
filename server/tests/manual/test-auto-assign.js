// Script to test auto-assignment logic
/* eslint-disable @typescript-eslint/no-require-imports */
// Native fetch() is available in Node.js v25+ — no external HTTP library needed
const pool = require('./db');

async function testAutoAssign() {
    try {
        console.log('🧪 اختبار نظام التعيين التلقائي...\n');

        // 1. Check if we have couriers
        const couriersResult = await pool.query(`
            SELECT id, name, is_available 
            FROM users 
            WHERE user_type = 'partner_courier'
            ORDER BY id
        `);

        console.log(`📋 المناديب الموجودين في النظام (${couriersResult.rows.length}):`);
        couriersResult.rows.forEach(c => {
            console.log(`  - ${c.name} (ID: ${c.id}) - ${c.is_available ? '✅ متاح' : '❌ غير متاح'}`);
        });

        if (couriersResult.rows.length === 0) {
            console.error('\n❌ لا يوجد مناديب في النظام!');
            process.exit(1);
        }

        console.log('\n📊 حساب الحمل الحالي لكل مندوب...');

        // 2. Calculate workload for each courier
        for (const courier of couriersResult.rows) {
            const countResult = await pool.query(`
                SELECT COUNT(*) as active_orders 
                FROM delivery_orders 
                WHERE courier_id = $1 
                AND status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                AND is_deleted = false
            `, [courier.id]);

            const workload = parseInt(countResult.rows[0].active_orders) || 0;
            console.log(`  - ${courier.name}: ${workload} طلب نشط`);
        }

        // 3. Check recent unassigned orders
        const unassignedOrders = await pool.query(`
            SELECT id, order_number, customer_name, created_at
            FROM delivery_orders 
            WHERE courier_id IS NULL 
            AND status = 'pending'
            AND is_deleted = false
            ORDER BY created_at DESC
            LIMIT 5
        `);

        if (unassignedOrders.rows.length > 0) {
            console.log(`\n⚠️  طلبات غير معينة (${unassignedOrders.rows.length}):`);
            unassignedOrders.rows.forEach(o => {
                console.log(`  - طلب #${o.id} (${o.order_number}) - ${o.customer_name} - ${new Date(o.created_at).toLocaleString('ar-EG')}`);
            });
        } else {
            console.log('\n✅ لا توجد طلبات غير معينة');
        }

        console.log('\n✅ الاختبار اكتمل بنجاح!');
        process.exit(0);

    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error.message);
        process.exit(1);
    }
}

testAutoAssign();
