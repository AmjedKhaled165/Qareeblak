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

        // Pick supervisors who are explicitly active only.
        const supervisorsResult = await pool.query(`
            SELECT u.id, u.name, u.username, u.max_active_orders,
                   COALESCE((
                       SELECT COUNT(*) FROM delivery_orders d
                       WHERE d.supervisor_id = u.id
                       AND d.status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                       AND COALESCE(d.is_deleted, false) = false
                   ), 0)::int as active_orders,
                   COALESCE((
                       SELECT COUNT(*) FROM delivery_orders d2
                       WHERE d2.supervisor_id = u.id
                       AND DATE(d2.created_at) = CURRENT_DATE
                       AND COALESCE(d2.is_deleted, false) = false
                   ), 0)::int as today_orders
            FROM users u
            WHERE COALESCE(u.user_type, u.role, '') IN ('supervisor', 'partner_supervisor', 'manager')
            AND COALESCE(u.is_available, false) = true
        `);

        logger.info(`[Auto-Assign] وجدنا ${supervisorsResult.rows.length} مسؤول نشط`);

        if (supervisorsResult.rows.length === 0) {
            logger.error(`[Auto-Assign] ❌ لا يوجد أي مسؤول في النظام!`);
            return null;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const supervisorIds = supervisorsResult.rows.map(s => s.id);
            const lockRes = await client.query(`
                SELECT id, name, max_active_orders FROM users
                WHERE id = ANY($1::int[]) 
                FOR UPDATE
            `, [supervisorIds]);

            const workloadResult = await client.query(`
                SELECT supervisor_id, COUNT(*) as active_orders
                FROM delivery_orders
                WHERE supervisor_id = ANY($1::int[])
                AND status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                AND COALESCE(is_deleted, false) = false
                GROUP BY supervisor_id
            `, [supervisorIds]);

            const todayLoadResult = await client.query(`
                SELECT supervisor_id, COUNT(*) as today_orders
                FROM delivery_orders
                WHERE supervisor_id = ANY($1::int[])
                AND DATE(created_at) = CURRENT_DATE
                AND COALESCE(is_deleted, false) = false
                GROUP BY supervisor_id
            `, [supervisorIds]);

            const workloadMap = workloadResult.rows.reduce((map, row) => {
                map[row.supervisor_id] = parseInt(row.active_orders) || 0;
                return map;
            }, {});

            const todayMap = todayLoadResult.rows.reduce((map, row) => {
                map[row.supervisor_id] = parseInt(row.today_orders) || 0;
                return map;
            }, {});

            const candidates = lockRes.rows.map(s => ({
                ...s,
                active_orders: workloadMap[s.id] || 0,
                today_orders: todayMap[s.id] || 0
            })).filter(s => s.active_orders < (s.max_active_orders || 100));

            if (candidates.length === 0) {
                await client.query('ROLLBACK');
                logger.error(`[Auto-Assign] ❌ All candidates are at full capacity!`);
                return null;
            }

            // Strategy: most orders today first, then currently most active workload, then stable by id.
            const selectedSupervisor = [...candidates].sort((a, b) => {
                const todayDiff = Number(b.today_orders || 0) - Number(a.today_orders || 0);
                if (todayDiff !== 0) return todayDiff;

                const activeDiff = Number(b.active_orders || 0) - Number(a.active_orders || 0);
                if (activeDiff !== 0) return activeDiff;

                return Number(a.id || 0) - Number(b.id || 0);
            })[0];

            logger.info(`[Auto-Assign] 🎯 تم اختيار المسؤول: ${selectedSupervisor.name}`);

            // 4. Assign order to selected supervisor
            await client.query(`
                UPDATE delivery_orders 
                SET supervisor_id = $1, 
                    status = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [selectedSupervisor.id, orderId, targetStatus]);

            await client.query('COMMIT');

            // Add to order history
            const assignedLoad = Number(selectedSupervisor.active_orders || 0) + 1;
            await pool.query(`
                INSERT INTO order_history (order_id, status, changed_by, notes)
                VALUES ($1, 'assigned', $2, $3)
            `, [orderId, userId || null, `تم التعيين التلقائي للمسؤول ${selectedSupervisor.name}`]);

            // Emit socket events so owner/courier dashboards refresh immediately.
            if (appIo) {
                appIo.emit('order-assigned', { orderId, supervisorId: selectedSupervisor.id, supervisorName: selectedSupervisor.name });
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

            return selectedSupervisor;

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
