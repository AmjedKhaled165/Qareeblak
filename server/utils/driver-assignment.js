const pool = require('../db');
const { syncParentOrderStatus } = require('./parent-sync');

/**
 * Automatically assigns an order to an available courier.
 * 
 * For APP orders: Selects a RANDOM active courier (is_online=true, active_orders < max_limit).
 * For MANUAL orders: This should NOT be called (courier is already assigned by creator).
 * Fallback: If no online couriers, falls back to any available courier with lowest workload.
 * 
 * @param {number|string} orderId - The ID of the order (halan_order_id)
 * @param {number|string} userId - The ID of the user triggering the action (for history)
 * @param {object} appIo - The Socket.IO instance
 * @param {string} targetStatus - The status to set after assignment (default: 'assigned')
 * @returns {Promise<object|null>} The assigned courier object or null if failed
 */
const performAutoAssign = async (orderId, userId, appIo, targetStatus = 'assigned') => {
    console.log(`[Auto-Assign] 🔍 بدء البحث عن مندوب للطلب #${orderId}...`);

    try {
        // GUARD: Check if this is a manual order — skip auto-assign entirely
        const orderCheck = await pool.query('SELECT order_type, courier_id, source FROM delivery_orders WHERE id = $1', [orderId]);
        if (orderCheck.rows.length > 0) {
            const order = orderCheck.rows[0];
            const isManual = order.order_type === 'manual' || (order.source && !order.source.includes('qareeblak'));
            
            // If manual AND already has a courier, skip completely
            if (isManual && order.courier_id) {
                console.log(`[Auto-Assign] ⏭️ Manual order #${orderId} already has courier #${order.courier_id}. Skipping.`);
                // Just update status if needed
                await pool.query(
                    'UPDATE delivery_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [targetStatus, orderId]
                );
                return null;
            }
        }

        // 1. PRIORITY: Get ONLINE couriers with capacity (for App orders)
        let couriersResult = await pool.query(`
            SELECT * FROM (
                SELECT u.id, u.name, u.username, u.max_active_orders,
                       COALESCE((
                           SELECT COUNT(*) FROM delivery_orders d 
                           WHERE d.courier_id = u.id 
                           AND d.status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                           AND d.is_deleted = false
                       ), 0)::int as active_orders
                FROM users u
                WHERE (u.role IN ('courier', 'partner_courier') OR u.user_type IN ('courier', 'partner_courier')) 
                AND (u.is_online = true OR u.is_available = true)
            ) sub
            WHERE sub.active_orders < COALESCE(sub.max_active_orders, 10)
        `);

        console.log(`[Auto-Assign] وجدنا ${couriersResult.rows.length} مندوب متاح ونشط`);

        // 2. FALLBACK: If no online couriers with capacity, try any available courier
        if (couriersResult.rows.length === 0) {
            console.log(`[Auto-Assign] ⚠️ لا يوجد مناديب نشطين، جاري البحث عن أي مندوب متاح...`);
            couriersResult = await pool.query(`
                SELECT id, name, username FROM users 
                WHERE (role IN ('courier', 'partner_courier') OR user_type IN ('courier', 'partner_courier')) 
                AND is_available = true
            `);
        }

        // 3. LAST RESORT: Any courier in the system
        if (couriersResult.rows.length === 0) {
            console.log(`[Auto-Assign] ⚠️ لا يوجد مناديب متاحين، سنختار من جميع المناديب...`);
            couriersResult = await pool.query(`
                SELECT id, name, username FROM users 
                WHERE (role IN ('courier', 'partner_courier') OR user_type IN ('courier', 'partner_courier'))
            `);
            console.log(`[Auto-Assign] إجمالي المناديب في النظام: ${couriersResult.rows.length}`);
        }

        if (couriersResult.rows.length === 0) {
            console.error(`[Auto-Assign] ❌ لا يوجد أي مناديب في النظام!`);
            return null;
        }

        // 4. Select courier: Random from available pool (weighted by lowest workload)
        let selectedCourier;
        
        if (couriersResult.rows[0].active_orders !== undefined) {
            // We have workload data from the priority query — pick random from lowest workload tier
            const minWorkload = Math.min(...couriersResult.rows.map(c => parseInt(c.active_orders) || 0));
            const bestCouriers = couriersResult.rows.filter(c => (parseInt(c.active_orders) || 0) === minWorkload);
            selectedCourier = bestCouriers[Math.floor(Math.random() * bestCouriers.length)];
        } else {
            // Fallback: Calculate workload manually
            const workloads = await Promise.all(
                couriersResult.rows.map(async (courier) => {
                    const countResult = await pool.query(`
                        SELECT COUNT(*) as active_orders 
                        FROM delivery_orders 
                        WHERE courier_id = $1 
                        AND status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                        AND is_deleted = false
                    `, [courier.id]);
                    return { ...courier, workload: parseInt(countResult.rows[0].active_orders) || 0 };
                })
            );
            const minWorkload = Math.min(...workloads.map(c => c.workload));
            const bestCouriers = workloads.filter(c => c.workload === minWorkload);
            selectedCourier = bestCouriers[Math.floor(Math.random() * bestCouriers.length)];
        }

        const courierLoad = selectedCourier.active_orders ?? selectedCourier.workload ?? '?';
        console.log(`[Auto-Assign] 🎯 تم اختيار المندوب: ${selectedCourier.name} (الحمل الحالي: ${courierLoad} طلبات)`);

        // 4. Assign order to selected courier
        await pool.query(`
            UPDATE delivery_orders 
            SET courier_id = $1, 
                status = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [selectedCourier.id, orderId, targetStatus]);

        // 5. Add to order history
        await pool.query(`
            INSERT INTO order_history (order_id, status, changed_by, notes)
            VALUES ($1, 'assigned', $2, $3)
        `, [orderId, userId || null, `تم التعيين تلقائياً للمندوب ${selectedCourier.name} (الحمل: ${courierLoad} طلبات)`]);

        // 6. Emit socket event
        if (appIo) {
            appIo.emit('order-assigned', { orderId, courierId: selectedCourier.id, courierName: selectedCourier.name });
            appIo.emit('order-status-changed', { orderId, status: targetStatus });
            // Also emit generic update so dashboards refresh
            appIo.emit('booking-updated', { halanOrderId: orderId, status: targetStatus });
        }

        // SYNC: Update parent order status if this is part of a grouped order
        try {
            const parentCheck = await pool.query('SELECT parent_order_id FROM bookings WHERE halan_order_id = $1', [orderId]);
            if (parentCheck.rows.length > 0 && parentCheck.rows[0].parent_order_id) {
                await syncParentOrderStatus(parentCheck.rows[0].parent_order_id, appIo);
            }
        } catch (e) {
            console.error('[Auto-Assign] Failed to sync parent status:', e.message);
        }

        return selectedCourier;

    } catch (error) {
        console.error(`[Auto-Assign] ❌ Critical Error:`, error);
        return null;
    }
};

module.exports = { performAutoAssign };
