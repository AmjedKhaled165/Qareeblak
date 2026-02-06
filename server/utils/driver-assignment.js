const pool = require('../db');

/**
 * Automatically assigns an order to the available courier with the lowest workload.
 * @param {number|string} orderId - The ID of the order (halan_order_id)
 * @param {number|string} userId - The ID of the user triggering the action (for history)
 * @param {object} appIo - The Socket.IO instance
 * @param {string} targetStatus - The status to set after assignment (default: 'assigned')
 * @returns {Promise<object|null>} The assigned courier object or null if failed
 */
const performAutoAssign = async (orderId, userId, appIo, targetStatus = 'assigned') => {
    console.log(`[Auto-Assign] 🔍 بدء البحث عن مندوب للطلب #${orderId}...`);

    try {
        // 1. Get all available couriers
        // Broaden search to include both role and user_type patterns
        let couriersResult = await pool.query(`
            SELECT id, name, username FROM users 
            WHERE (role IN ('courier', 'partner_courier') OR user_type IN ('courier', 'partner_courier')) 
            AND is_available = true
        `);

        console.log(`[Auto-Assign] وجدنا ${couriersResult.rows.length} مندوب متاح`);

        // FALLBACK: If no "Available" couriers, take ANY courier 
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
        `, [orderId, userId || null, `تم التعيين تلقائياً للمندوب ${selectedCourier.name} (الحمل: ${selectedCourier.workload} طلبات)`]);

        // 6. Emit socket event
        if (appIo) {
            appIo.emit('order-assigned', { orderId, courierId: selectedCourier.id, courierName: selectedCourier.name });
            appIo.emit('order-status-changed', { orderId, status: targetStatus });
            // Also emit generic update so dashboards refresh
            appIo.emit('booking-updated', { halanOrderId: orderId, status: targetStatus });
        }

        return selectedCourier;

    } catch (error) {
        console.error(`[Auto-Assign] ❌ Critical Error:`, error);
        return null;
    }
};

module.exports = { performAutoAssign };
