const pool = require('../db');
const { syncParentOrderStatus } = require('./parent-sync');
const logger = require('./logger');

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
    logger.info(`[Auto-Assign] 🔍 بدء البحث عن مندوب للطلب #${orderId}...`);

    try {
        // GUARD: Check if this is a manual order — skip auto-assign entirely
        const orderCheck = await pool.query('SELECT order_type, courier_id, source FROM delivery_orders WHERE id = $1', [orderId]);
        if (orderCheck.rows.length > 0) {
            const order = orderCheck.rows[0];
            const isManual = order.order_type === 'manual' || (order.source && !order.source.includes('qareeblak'));

            // If manual AND already has a courier, skip completely
            if (isManual && order.courier_id) {
                logger.info(`[Auto-Assign] ⏭️ Manual order #${orderId} already has courier #${order.courier_id}. Skipping.`);
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

        logger.info(`[Auto-Assign] وجدنا ${couriersResult.rows.length} مندوب متاح ونشط`);

        // 2. FALLBACK: If no online couriers with capacity, try any available courier
        if (couriersResult.rows.length === 0) {
            logger.warn(`[Auto-Assign] ⚠️ لا يوجد مناديب نشطين، جاري البحث عن أي مندوب متاح...`);
            couriersResult = await pool.query(`
                SELECT id, name, username FROM users 
                WHERE (role IN ('courier', 'partner_courier') OR user_type IN ('courier', 'partner_courier')) 
                AND is_available = true
            `);
        }

        // 3. LAST RESORT: Any courier in the system
        if (couriersResult.rows.length === 0) {
            logger.warn(`[Auto-Assign] ⚠️ لا يوجد مناديب متاحين، سنختار من جميع المناديب...`);
            couriersResult = await pool.query(`
                SELECT id, name, username FROM users 
                WHERE (role IN ('courier', 'partner_courier') OR user_type IN ('courier', 'partner_courier'))
            `);
            logger.info(`[Auto-Assign] إجمالي المناديب في النظام: ${couriersResult.rows.length}`);
        }

        if (couriersResult.rows.length === 0) {
            logger.error(`[Auto-Assign] ❌ لا يوجد أي مناديب في النظام!`);
            return null;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const courierIds = couriersResult.rows.map(c => c.id);
            // [ENTERPRISE HARDENING] Sort to prevent deadlocks and lock ALL candidate couriers or just the one we select?
            // Locking the entire pool of candidates is safer for load balancing.
            const lockRes = await client.query(`
                SELECT id, name, max_active_orders FROM users 
                WHERE id = ANY($1::int[]) 
                FOR UPDATE
            `, [courierIds]);

            // Re-calculate workload for locked couriers to get the TRUE state
            const workloadResult = await client.query(`
                SELECT courier_id, COUNT(*) as active_orders
                FROM delivery_orders
                WHERE courier_id = ANY($1::int[])
                AND status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                AND is_deleted = false
                GROUP BY courier_id
            `, [courierIds]);

            const workloadMap = workloadResult.rows.reduce((map, row) => {
                map[row.courier_id] = parseInt(row.active_orders) || 0;
                return map;
            }, {});

            const candidates = lockRes.rows.map(c => ({
                ...c,
                active_orders: workloadMap[c.id] || 0
            })).filter(c => c.active_orders < (c.max_active_orders || 10));

            if (candidates.length === 0) {
                await client.query('ROLLBACK');
                logger.error(`[Auto-Assign] ❌ All candidates are at full capacity!`);
                return null;
            }

            // Pick candidate with lowest workload
            const minWorkload = Math.min(...candidates.map(c => c.active_orders));
            const bestCouriers = candidates.filter(c => c.active_orders === minWorkload);
            const selectedCourier = bestCouriers[Math.floor(Math.random() * bestCouriers.length)];

            logger.info(`[Auto-Assign] 🎯 تم اختيار المندوب: ${selectedCourier.name} (الحمل الحالي: ${selectedCourier.active_orders} طلبات)`);

            // 4. Assign order to selected courier
            await client.query(`
                UPDATE delivery_orders 
                SET courier_id = $1, 
                    status = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [selectedCourier.id, orderId, targetStatus]);

            await client.query('COMMIT');

            // Add to order history after successful commit.
            const assignedLoad = Number(selectedCourier.active_orders || 0) + 1;
            await pool.query(`
                INSERT INTO order_history (order_id, status, changed_by, notes)
                VALUES ($1, 'assigned', $2, $3)
            `, [orderId, userId || null, `تم التعيين تلقائياً للمندوب ${selectedCourier.name} (الحمل: ${assignedLoad} طلبات)`]);

            // Emit socket events so owner/courier dashboards refresh immediately.
            if (appIo) {
                appIo.emit('order-assigned', { orderId, courierId: selectedCourier.id, courierName: selectedCourier.name });
                appIo.emit('order-status-changed', { orderId, status: targetStatus });
                appIo.emit('booking-updated', { halanOrderId: orderId, status: targetStatus });
            }

            // Sync parent order state for grouped orders linked to this delivery order.
            try {
                const parentCheck = await pool.query('SELECT parent_order_id FROM bookings WHERE halan_order_id = $1 LIMIT 1', [orderId]);
                if (parentCheck.rows.length > 0 && parentCheck.rows[0].parent_order_id) {
                    await syncParentOrderStatus(parentCheck.rows[0].parent_order_id, appIo);
                }
            } catch (e) {
                logger.error(`[Auto-Assign] Failed to sync parent status: ${e.message}`);
            }

            return selectedCourier;

        } catch (txnError) {
            await client.query('ROLLBACK');
            throw txnError;
        } finally {
            client.release();
        }

    } catch (error) {
        logger.error(`[Auto-Assign] ❌ Critical Error: ${error.message}`);
        return null;
    }
};

module.exports = { performAutoAssign };
