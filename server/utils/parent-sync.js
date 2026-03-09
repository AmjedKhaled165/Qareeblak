const { pool } = require('../db');
const { createNotification } = require('../routes/notifications');
const logger = require('./logger');

// Strict Application State ENUMS mapping UI/DB states effectively against Database Enum types
const OrderStates = {
    // Rejection / Cancel States
    CANCELLED: new Set(['cancelled', 'rejected']),
    // Confirmed / Acting States
    CONFIRMED: new Set(['confirmed', 'accepted', 'processing', 'assigned', 'accepted_by_provider']),
    // Ready States
    READY: new Set(['completed', 'ready_for_pickup', 'ready', 'archived']),
    // In Transit
    PICKED_UP: new Set(['picked_up', 'in_transit']),
    // Delivery Finished
    DELIVERED: new Set(['delivered'])
};

/**
 * Recalculates and updates the status of a parent order based on its sub-orders (bookings)
 * @param {number|string} parentId The ID of the parent order
 * @param {object} io Socket.io instance for broadcasting updates
 */
async function syncParentOrderStatus(parentId, io) {
    if (!parentId) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Lock Parent Order row to prevent race conditions during sync
        const parentRes = await client.query('SELECT status, user_id FROM parent_orders WHERE id = $1 FOR UPDATE', [parentId]);
        if (parentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return;
        }
        const currentParentStatus = parentRes.rows[0].status;
        const parentUserId = parentRes.rows[0].user_id;

        // 2. Fetch all sub-orders (bookings) + delivery status
        const result = await client.query(`
            SELECT 
                b.status as booking_status,
                d.status as delivery_status
            FROM bookings b
            LEFT JOIN delivery_orders d ON b.halan_order_id = d.id
            WHERE b.parent_order_id = $1
        `, [parentId]);

        // 3. The Validation Query: Count totals (Exclude cancelled/rejected)
        const activeRows = result.rows.filter(row => {
            const s = String(row.booking_status || '').toLowerCase().trim();
            return !OrderStates.CANCELLED.has(s);
        });
        const total_required = activeRows.length;

        let total_accepted = 0;
        let countReady = 0;
        let countPickedUp = 0;
        let countDelivered = 0;

        activeRows.forEach(row => {
            const bS = String(row.booking_status || '').toLowerCase().trim();
            const dS = String(row.delivery_status || '').toLowerCase().trim();

            let level = 1; // Default Pending

            if (OrderStates.DELIVERED.has(dS) || OrderStates.DELIVERED.has(bS)) level = 5;
            else if (OrderStates.PICKED_UP.has(dS) || OrderStates.PICKED_UP.has(bS)) level = 4;
            else if (OrderStates.READY.has(dS) || OrderStates.READY.has(bS)) level = 3;
            else if (OrderStates.CONFIRMED.has(dS) || OrderStates.CONFIRMED.has(bS)) level = 2;

            if (level >= 2) total_accepted++;
            if (level >= 3) countReady++;
            if (level >= 4) countPickedUp++;
            if (level >= 5) countDelivered++;

            // Debug individual row
            logger.info(`[ParentSync] Row: Booking=${bS}, Delivery=${dS} -> Level=${level}`);
        });

        // Debug Log requested by user
        logger.info(`[ParentSync] Order ID: ${parentId} Required: ${total_required} Current Prepared: ${countReady}`);

        // 4. The If/Else Guard (Gatekeeper)
        if (total_accepted < total_required) {
            logger.info(`[ParentSync] Gatekeeper: Only ${total_accepted}/${total_required} providers accepted. Waiting for others...`);
            // Do NOT change the Global Order Status. Return/Exit.
            await client.query('COMMIT');
            return;
        }

        // IF total_accepted == total_required:
        // ONLY NOW, determine the new global status.
        // We know at least everyone is confirmed (In Preparation).

        let newGlobalStatus = 'confirmed'; // "In Preparation"

        // Check for higher statuses (Strict ALL required for these too)
        if (countDelivered === total_required) {
            newGlobalStatus = 'delivered';
        } else if (countPickedUp === total_required) {
            newGlobalStatus = 'picked_up';
        } else if (countReady === total_required) {
            newGlobalStatus = 'ready_for_pickup';
        }

        // Update Global Status if different
        if (newGlobalStatus !== currentParentStatus) {
            logger.info(`[ParentSync] All Providers Agreed! Updating Global Status: ${currentParentStatus} -> ${newGlobalStatus}`);
            await client.query('UPDATE parent_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newGlobalStatus, parentId]);

            if (io) {
                io.emit('order-status-changed', { orderId: `P${parentId}`, status: newGlobalStatus });
            }

            // 🔔 HIGH-PRIORITY NOTIFICATION: All sub-orders are ready!
            if (newGlobalStatus === 'ready_for_pickup' && parentUserId) {
                logger.info(`[ParentSync] 🔔 All providers ready! Sending notification to user #${parentUserId}`);
                try {
                    await createNotification(
                        parentUserId,
                        `🎉 الطلب #${parentId} جاهز بالكامل! جميع مقدمي الخدمة أتموا التحضير.`,
                        'order_ready',
                        parentId,
                        io
                    );
                } catch (notifErr) {
                    logger.error(`[ParentSync] Notification error: ${notifErr.message}`);
                }
            }
        } else {
            logger.info(`[ParentSync] Status matches target (${newGlobalStatus}). No update needed.`);
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        logger.error(`[ParentSync] Transaction Error: ${e.message}`);
    } finally {
        client.release();
    }
}

module.exports = { syncParentOrderStatus };
