// Script to auto-assign existing unassigned orders
/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');

// Copy the performAutoAssign function
const performAutoAssign = async (orderId, userId = 0) => {
    console.log(`[Auto-Assign] 🔍 بدء البحث عن مندوب للطلب #${orderId}...`);

    // 1. Get all available couriers
    let couriersResult = await pool.query(`
        SELECT id, name, username FROM users 
        WHERE user_type = 'partner_courier' AND is_available = true
    `);

    console.log(`[Auto-Assign] وجدنا ${couriersResult.rows.length} مندوب متاح`);

    // FALLBACK: If no "Available" couriers, take ANY courier
    if (couriersResult.rows.length === 0) {
        console.log(`[Auto-Assign] ⚠️ لا يوجد مناديب متاحين، سنختار من جميع المناديب...`);
        couriersResult = await pool.query(`
            SELECT id, name, username FROM users 
            WHERE user_type = 'partner_courier'
        `);
        console.log(`[Auto-Assign] إجمالي المناديب في النظام: ${couriersResult.rows.length}`);
    }

    if (couriersResult.rows.length === 0) {
        console.error(`[Auto-Assign] ❌ لا يوجد أي مناديب في النظام!`);
        throw new Error('لم يتم العثور على أي مناديب في النظام');
    }

    // 2. Calculate workload for each courier
    const workloads = await Promise.all(
        couriersResult.rows.map(async (courier) => {
            const countResult = await pool.query(`
                SELECT COUNT(*) as active_orders 
                FROM delivery_orders 
                WHERE courier_id = $1 
                AND status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                AND is_deleted = false
            `, [courier.id]);

            return {
                ...courier,
                workload: parseInt(countResult.rows[0].active_orders) || 0
            };
        })
    );

    // 3. Find the lowest workload and pick a courier
    const minWorkload = Math.min(...workloads.map(c => c.workload));
    const bestCouriers = workloads.filter(c => c.workload === minWorkload);
    const selectedCourier = bestCouriers[Math.floor(Math.random() * bestCouriers.length)];

    console.log(`[Auto-Assign] 🎯 تم اختيار المندوب: ${selectedCourier.name} (الحمل الحالي: ${selectedCourier.workload} طلبات)`);
    console.log(`[Auto-Assign] المناديب المتاحين بنفس الحمل: ${bestCouriers.map(c => `${c.name}(${c.workload})`).join(', ')}`);

    // 4. Assign order to selected courier
    await pool.query(`
        UPDATE delivery_orders 
        SET courier_id = $1, 
            status = 'assigned',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [selectedCourier.id, orderId]);

    // 5. Add to order history
    await pool.query(`
        INSERT INTO order_history (order_id, status, changed_by, notes)
        VALUES ($1, 'assigned', $2, $3)
    `, [orderId, userId || null, `تم التعيين تلقائياً للمندوب ${selectedCourier.name} (الحمل: ${selectedCourier.workload} طلبات)`]);

    return {
        id: selectedCourier.id,
        name: selectedCourier.name,
        workload: selectedCourier.workload
    };
};

async function fixUnassignedOrders() {
    try {
        console.log('🔧 إصلاح الطلبات غير المعينة...\n');

        // Get all unassigned orders
        const unassignedOrders = await pool.query(`
            SELECT id, order_number, customer_name
            FROM delivery_orders 
            WHERE courier_id IS NULL 
            AND status = 'pending'
            AND is_deleted = false
            ORDER BY created_at ASC
        `);

        if (unassignedOrders.rows.length === 0) {
            console.log('✅ لا توجد طلبات غير معينة');
            process.exit(0);
        }

        console.log(`📦 وجدنا ${unassignedOrders.rows.length} طلب غير معين\n`);

        // Assign each order
        for (const order of unassignedOrders.rows) {
            console.log(`\n📌 معالجة الطلب #${order.id} (${order.order_number}) - ${order.customer_name}`);

            try {
                const assignedCourier = await performAutoAssign(order.id, 0);
                console.log(`✅ تم تعيين الطلب #${order.id} للمندوب ${assignedCourier.name}\n`);
            } catch (error) {
                console.error(`❌ فشل تعيين الطلب #${order.id}:`, error.message);
            }
        }

        console.log('\n✅ تم الانتهاء من إصلاح جميع الطلبات!');
        process.exit(0);

    } catch (error) {
        console.error('❌ خطأ في الإصلاح:', error.message);
        process.exit(1);
    }
}

fixUnassignedOrders();
