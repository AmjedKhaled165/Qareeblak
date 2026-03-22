const pool = require('../db');
const { createNotification } = require('../routes/notifications');
const logger = require('./logger');

let parentOrdersColumnsCache = null;
let bookingsColumnsCache = null;
let deliveryOrdersColumnsCache = null;

async function getTableColumns(tableName) {
    const cacheRef = tableName === 'parent_orders'
        ? parentOrdersColumnsCache
        : tableName === 'bookings'
            ? bookingsColumnsCache
            : deliveryOrdersColumnsCache;

    if (cacheRef) return cacheRef;

    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
    );

    const cols = new Set(result.rows.map((row) => row.column_name));
    if (tableName === 'parent_orders') parentOrdersColumnsCache = cols;
    if (tableName === 'bookings') bookingsColumnsCache = cols;
    if (tableName === 'delivery_orders') deliveryOrdersColumnsCache = cols;
    return cols;
}

function pickColumn(cols, candidates) {
    for (const c of candidates) {
        if (cols.has(c)) return c;
    }
    return null;
}

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

    const parentCols = await getTableColumns('parent_orders');
    const bookingCols = await getTableColumns('bookings');
    const deliveryCols = await getTableColumns('delivery_orders');

    const parentStatusCol = pickColumn(parentCols, ['status', 'order_status', 'state']);
    const parentUserCol = pickColumn(parentCols, ['user_id', 'customer_id']);
    const parentUpdatedAtCol = pickColumn(parentCols, ['updated_at']);
    const bookingStatusCol = pickColumn(bookingCols, ['status', 'order_status', 'state']);
    const bookingParentCol = pickColumn(bookingCols, ['parent_order_id', 'parent_id']);
    const bookingDeliveryCol = pickColumn(bookingCols, ['halan_order_id', 'delivery_order_id']);
    const deliveryStatusCol = pickColumn(deliveryCols, ['status', 'order_status', 'state']);

    if (!parentStatusCol || !bookingParentCol) {
        logger.warn('[ParentSync] Missing required columns in parent_orders/bookings; skipping sync');
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Lock Parent Order row to prevent race conditions during sync
        const parentRes = await client.query(
            `SELECT ${parentStatusCol} AS status, ${parentUserCol ? parentUserCol : 'NULL'} AS user_id
             FROM parent_orders
             WHERE id = $1
             FOR UPDATE`,
            [parentId]
        );
        if (parentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return;
        }
        const currentParentStatus = parentRes.rows[0].status;
        const parentUserId = parentRes.rows[0].user_id;

        // 2. Fetch all sub-orders (bookings) + delivery status
        const bookingStatusSelect = bookingStatusCol ? `b.${bookingStatusCol}` : `NULL`;
        const deliveryJoin = bookingDeliveryCol ? `LEFT JOIN delivery_orders d ON b.${bookingDeliveryCol} = d.id` : ``;
        const deliveryStatusSelect = deliveryStatusCol ? `d.${deliveryStatusCol}` : `NULL`;
        const result = await client.query(
            `SELECT
                ${bookingStatusSelect} as booking_status,
                ${deliveryStatusSelect} as delivery_status
             FROM bookings b
             ${deliveryJoin}
             WHERE b.${bookingParentCol} = $1`,
            [parentId]
        );

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

        // 4. Compute global status
        // Business rule:
        // - confirmed starts as soon as ANY provider accepts
        // - higher stages remain strict and require ALL active providers
        let newGlobalStatus = 'pending';

        if (total_required > 0 && countDelivered === total_required) {
            newGlobalStatus = 'delivered';
        } else if (total_required > 0 && countPickedUp === total_required) {
            newGlobalStatus = 'picked_up';
        } else if (total_required > 0 && countReady === total_required) {
            newGlobalStatus = 'ready_for_pickup';
        } else if (total_accepted > 0) {
            newGlobalStatus = 'confirmed';
        }

        // Update Global Status if different
        if (newGlobalStatus !== currentParentStatus) {
            logger.info(`[ParentSync] Updating Global Status: ${currentParentStatus} -> ${newGlobalStatus} (accepted ${total_accepted}/${total_required})`);
            const updateSql = parentUpdatedAtCol
                ? `UPDATE parent_orders SET ${parentStatusCol} = $1, ${parentUpdatedAtCol} = CURRENT_TIMESTAMP WHERE id = $2`
                : `UPDATE parent_orders SET ${parentStatusCol} = $1 WHERE id = $2`;
            await client.query(updateSql, [newGlobalStatus, parentId]);

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
