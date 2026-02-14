const db = require('../db');
const logger = require('./logger');

/**
 * PRODUCTION-GRADE PARENT STATUS SYNC
 * Synchronizes the status of a parent order (basket) based on individual sub-orders.
 * Implements strict gatekeeping: many-to-one status aggregation.
 */
async function syncParentOrderStatus(parentId, io) {
    if (!parentId) return;

    logger.info(`[ParentSync] 🔄 Syncing global status for Parent #${parentId}`);

    try {
        // Use a transaction for consistency
        await db.query('BEGIN');

        // 1. Lock and Get Parent Info
        const parentRes = await db.query('SELECT status FROM parent_orders WHERE id = $1 FOR UPDATE', [parentId]);
        if (parentRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return;
        }
        const currentParentStatus = parentRes.rows[0].status;

        // 2. Aggregate Sub-Order Statuses
        const result = await db.query(`
            SELECT 
                b.status as booking_status,
                d.status as delivery_status
            FROM bookings b
            LEFT JOIN delivery_orders d ON b.halan_order_id = d.id
            WHERE b.parent_order_id = $1
        `, [parentId]);

        // Filter active rows
        const activeRows = result.rows.filter(row => {
            const s = (row.booking_status || '').toLowerCase().trim();
            return !['cancelled', 'rejected', 'ملغي', 'مرفوض'].includes(s);
        });

        if (activeRows.length === 0) {
            await db.query('COMMIT');
            return;
        }

        const totalRequired = activeRows.length;

        // Semantic Status Mapping
        const confirmedSet = new Set(['confirmed', 'accepted', 'processing', 'assigned', 'جاري التنفيذ', 'تم القبول', 'جاري التحضير', 'accepted_by_provider']);
        const readySet = new Set(['completed', 'ready_for_pickup', 'ready', 'مكتمل', 'مكتملة', 'arkived', 'archived', 'تم التجهيز', 'جاهز للاستلام', 'تم التحضير']);
        const pickedUpSet = new Set(['picked_up', 'in_transit', 'جاري التوصيل', 'مع المندوب', 'تم استلام من المطعم', 'تم الاستلام من المطعم']);
        const deliveredSet = new Set(['delivered', 'تم التوصيل', 'وصل']);

        let counters = { accepted: 0, ready: 0, pickedUp: 0, delivered: 0 };

        activeRows.forEach(row => {
            const bS = (row.booking_status || '').toLowerCase().trim();
            const dS = (row.delivery_status || '').toLowerCase().trim();

            let level = 1; // Pending
            if (deliveredSet.has(dS) || deliveredSet.has(bS)) level = 5;
            else if (pickedUpSet.has(dS) || pickedUpSet.has(bS)) level = 4;
            else if (readySet.has(dS) || readySet.has(bS)) level = 3;
            else if (confirmedSet.has(dS) || confirmedSet.has(bS)) level = 2;

            if (level >= 2) counters.accepted++;
            if (level >= 3) counters.ready++;
            if (level >= 4) counters.pickedUp++;
            if (level >= 5) counters.delivered++;
        });

        // 3. Status Gatekeeper Decision
        let newGlobalStatus = currentParentStatus;

        if (counters.accepted === totalRequired) {
            newGlobalStatus = 'confirmed';
            if (counters.ready === totalRequired) newGlobalStatus = 'ready_for_pickup';
            if (counters.pickedUp === totalRequired) newGlobalStatus = 'picked_up';
            if (counters.delivered === totalRequired) newGlobalStatus = 'delivered';
        }

        // 4. Atomic Update
        if (newGlobalStatus !== currentParentStatus) {
            logger.info(`[ParentSync] 📈 Global Status Upgrade: ${currentParentStatus} -> ${newGlobalStatus}`);
            await db.query('UPDATE parent_orders SET status = $1, updated_at = NOW() WHERE id = $2', [newGlobalStatus, parentId]);

            if (io) {
                io.emit('order-status-changed', { orderId: `P${parentId}`, status: newGlobalStatus });
            }
        }

        await db.query('COMMIT');
    } catch (e) {
        await db.query('ROLLBACK').catch(() => { });
        logger.error('[ParentSync] Transactional Sync Failed:', e);
    }
}

module.exports = { syncParentOrderStatus };
