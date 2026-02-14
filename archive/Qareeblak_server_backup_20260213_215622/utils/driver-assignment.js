const db = require('../db');
const { syncParentOrderStatus } = require('./parent-sync');
const logger = require('./logger');

/**
 * PRODUCTION-GRADE AUTO-ASSIGNMENT LOGIC
 * Optimized for high-throughput and minimal database round-trips.
 */

const performAutoAssign = async (orderId, userId, appIo, targetStatus = 'assigned') => {
    logger.info(`[Auto-Assign] 🔍 Searching for courier for order #${orderId}...`);

    try {
        // Find the best courier: Available, lowest current workload, random tie-breaker.
        // We use a single query with LEFT JOIN to count current active orders.
        const bestCourierResult = await db.query(`
            SELECT u.id, u.name, u.username, COUNT(o.id) as workload
            FROM users u
            LEFT JOIN delivery_orders o ON u.id = o.courier_id 
                AND o.status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                AND o.is_deleted = false
            WHERE (u.user_type IN ('partner_courier', 'courier'))
            AND u.is_available = true
            GROUP BY u.id
            ORDER BY workload ASC, RANDOM()
            LIMIT 1
        `);

        let selectedCourier = bestCourierResult.rows[0];

        // Fallback: If no "Available" couriers, pick any courier (even if offline) to ensure order is processed
        if (!selectedCourier) {
            logger.warn(`[Auto-Assign] ⚠️ No available couriers found. Falling back to all couriers...`);
            const allCourierResult = await db.query(`
                SELECT u.id, u.name, u.username, COUNT(o.id) as workload
                FROM users u
                LEFT JOIN delivery_orders o ON u.id = o.courier_id 
                    AND o.status IN ('pending', 'assigned', 'ready_for_pickup', 'picked_up', 'in_transit')
                    AND o.is_deleted = false
                WHERE (u.user_type IN ('partner_courier', 'courier'))
                GROUP BY u.id
                ORDER BY workload ASC, RANDOM()
                LIMIT 1
            `);
            selectedCourier = allCourierResult.rows[0];
        }

        if (!selectedCourier) {
            logger.error(`[Auto-Assign] ❌ No couriers exist in the system at all!`);
            return null;
        }

        logger.info(`[Auto-Assign] 🎯 Selected courier: ${selectedCourier.name} (Workload: ${selectedCourier.workload})`);

        // Transactional Update
        await db.query('BEGIN');

        await db.query(`
            UPDATE delivery_orders 
            SET courier_id = $1, 
                status = $3,
                updated_at = NOW()
            WHERE id = $2
        `, [selectedCourier.id, orderId, targetStatus]);

        await db.query(`
            INSERT INTO order_history (order_id, status, changed_by, notes)
            VALUES ($1, 'assigned', $2, $3)
        `, [orderId, userId || null, `تم التعيين تلقائياً لـ ${selectedCourier.name}`]);

        await db.query('COMMIT');

        // Socket notifications
        if (appIo) {
            appIo.emit('order-assigned', { orderId, courierId: selectedCourier.id, courierName: selectedCourier.name });
            appIo.emit('order-status-changed', { orderId, status: targetStatus });
            appIo.emit('booking-updated', { halanOrderId: orderId, status: targetStatus });
        }

        // Parent Sync
        try {
            const parentCheck = await db.query('SELECT parent_order_id FROM bookings WHERE halan_order_id::text = $1', [String(orderId)]);
            if (parentCheck.rows.length > 0 && parentCheck.rows[0].parent_order_id) {
                await syncParentOrderStatus(parentCheck.rows[0].parent_order_id, appIo);
            }
        } catch (e) {
            logger.error('[Auto-Assign] Parent Sync Error:', e);
        }

        return selectedCourier;

    } catch (error) {
        await db.query('ROLLBACK').catch(() => { });
        logger.error(`[Auto-Assign] Critical Error:`, error);
        return null;
    }
};

module.exports = { performAutoAssign };
