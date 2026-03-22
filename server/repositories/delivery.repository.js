const pool = require('../db');

let deliveryOrdersColumnsCache = null;

async function getDeliveryOrdersColumns() {
    if (deliveryOrdersColumnsCache) return deliveryOrdersColumnsCache;

    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'delivery_orders'`
    );

    deliveryOrdersColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return deliveryOrdersColumnsCache;
}

class DeliveryRepository {
    async beginTransaction() {
        const client = await pool.connect();
        await client.query('BEGIN');
        return client;
    }

    async commitTransaction(client) {
        await client.query('COMMIT');
        client.release();
    }

    async rollbackTransaction(client) {
        await client.query('ROLLBACK');
        client.release();
    }

    /**
     * @param {{role: string, userId: number, status: string, courierId: number, supervisorId: number, search: string, source: string, limit: number, lastId: number}} options
     */
    async getOrders({ role, userId, status, courierId, supervisorId, search, source, limit = 20, lastId }) {
        const params = [];
        const conditions = [];

        // Security: Mandatory filtering for non-admins
        // partner_owner should have owner-level visibility (all orders).
        const isAdmin = role === 'admin' || role === 'owner' || role === 'partner_owner';

        if (!isAdmin) {
            if (role === 'courier' || role === 'partner_courier') {
                params.push(userId);
                const courierParamIdx = params.length;
                conditions.push(`(
                    o.courier_id = $${courierParamIdx}
                    OR (o.courier_id IS NULL AND o.status IN ('pending', 'ready_for_pickup'))
                )`);
            } else if (role === 'supervisor' || role === 'partner_supervisor') {
                params.push(userId);
                conditions.push(`o.supervisor_id = $${params.length}`);
            } else {
                conditions.push('1=0');
            }
        }

        // Keyset Pagination: O(log N)
        if (lastId) {
            params.push(lastId);
            conditions.push(`o.id < $${params.length}`);
        }

        if (status === 'deleted') {
            conditions.push(`COALESCE(o.is_deleted, false) = true`);
        } else if (status === 'edited') {
            conditions.push(`o.is_edited = true AND COALESCE(o.is_deleted, false) = false`);
        } else {
            conditions.push(`COALESCE(o.is_deleted, false) = false`);
            if (status && status !== 'all') {
                params.push(status);
                conditions.push(`o.status = $${params.length}`);
            }
        }

        if (courierId) {
            params.push(courierId);
            conditions.push(`o.courier_id = $${params.length}`);
        }
        if (supervisorId) {
            params.push(supervisorId);
            conditions.push(`o.supervisor_id = $${params.length}`);
        }
        if (source) {
            params.push(source);
            conditions.push(`o.source = $${params.length}`);
        }

        if (search) {
            const searchTerm = search.trim();
            params.push(`%${searchTerm}%`);
            const pIdx = params.length;
            params.push(searchTerm);
            const rIdx = params.length;
            conditions.push(`(
                o.customer_name ILIKE $${pIdx} OR 
                o.customer_phone ILIKE $${pIdx} OR 
                o.delivery_address ILIKE $${pIdx} OR 
                o.notes ILIKE $${pIdx} OR 
                o.items::text ILIKE $${pIdx} OR
                o.id::text = $${rIdx}
            )`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        params.push(Math.min(limit, 50));
        const query = `
            SELECT o.*, 
                   c.name as courier_name,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${whereClause}
            ORDER BY o.id DESC
            LIMIT $${params.length}
        `;

        const result = await pool.query(query, params);
        const rows = result.rows;

        return {
            records: rows,
            nextLastId: rows.length > 0 ? rows[rows.length - 1].id : null,
            hasMore: rows.length === limit
        };
    }

    async getOrderById(id) {
        const query = `
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            WHERE o.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    async getOrderByIdSecure(id, { userId, role }) {
        const normalizedRole = String(role || '').toLowerCase();
        const isAdmin = ['admin', 'owner', 'partner_owner'].includes(normalizedRole);

        if (isAdmin) {
            return this.getOrderById(id);
        }

        const isCourier = ['courier', 'partner_courier'].includes(normalizedRole);
        const isSupervisor = ['supervisor', 'partner_supervisor'].includes(normalizedRole);

        const params = [id];
        const conditions = ['o.id = $1'];

        if (isCourier) {
            params.push(userId);
            conditions.push(`(
                o.courier_id = $2
                OR (o.courier_id IS NULL AND o.status IN ('pending', 'ready_for_pickup'))
            )`);
        } else if (isSupervisor) {
            params.push(userId);
            conditions.push('o.supervisor_id = $2');
        } else {
            return null;
        }

        const query = `
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            WHERE ${conditions.join(' AND ')}
            LIMIT 1
        `;

        const result = await pool.query(query, params);
        return result.rows[0] || null;
    }

    async updateOrderAtomic(id, expectedStatus, updates, client = pool) {
        // [ENTERPRISE] Atomic Compare-and-Swap
        const fields = Object.keys(updates);
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const params = [...Object.values(updates), id];
        const cols = await getDeliveryOrdersColumns();
        const updatedAtClause = cols.has('updated_at') ? ', updated_at = NOW()' : '';

        // If expectedStatus is provided, enforce it in the WHERE clause
        let query = `UPDATE delivery_orders SET ${setClause}${updatedAtClause} WHERE id = $${params.length}`;
        if (expectedStatus) {
            params.push(expectedStatus);
            query += ` AND status = $${params.length}`;
        }

        query += ` RETURNING *`;

        const result = await client.query(query, params);
        if (result.rowCount === 0) {
            throw new Error('ORDER_STATUS_MISMATCH_OR_NOT_FOUND');
        }
        return result.rows[0];
    }

    async createDeliveryOrder(data, client = pool) {
        const query = `
            INSERT INTO delivery_orders 
            (order_number, customer_name, customer_phone, pickup_address, delivery_address,
             pickup_lat, pickup_lng, delivery_lat, delivery_lng,
             courier_id, supervisor_id, status, notes, delivery_fee, items, source, order_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `;
        const params = [
            data.orderNumber, data.customerName, data.customerPhone, data.pickupAddress, data.deliveryAddress,
            data.pLat, data.pLng, data.dLat, data.dLng,
            data.courierId, data.supervisorId, data.status, data.notes, data.deliveryFee,
            JSON.stringify(data.items), data.source, data.orderType
        ];
        const result = await client.query(query, params);
        return result.rows[0];
    }

    async updateOrder(id, data) {
        const fields = Object.keys(data);
        if (fields.length === 0) return null;

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const params = Object.values(data);
        params.push(id);
        const cols = await getDeliveryOrdersColumns();
        const updatedAtClause = cols.has('updated_at') ? ', updated_at = NOW()' : '';

        const query = `UPDATE delivery_orders SET ${setClause}${updatedAtClause} WHERE id = $${params.length} RETURNING *`;
        const result = await pool.query(query, params);
        return result.rows[0];
    }

    async getLinkedBookings(orderId) {
        const result = await pool.query(
            `SELECT id, parent_order_id, status
             FROM bookings
             WHERE CAST(halan_order_id AS TEXT) = CAST($1 AS TEXT)`,
            [String(orderId)]
        );
        return result.rows || [];
    }

    async softDelete(id) {
        const cols = await getDeliveryOrdersColumns();

        if (cols.has('is_deleted')) {
            const setClauses = ['is_deleted = true'];
            if (cols.has('updated_at')) {
                setClauses.push('updated_at = NOW()');
            }

            await pool.query(
                `UPDATE delivery_orders
                 SET ${setClauses.join(', ')}
                 WHERE id = $1`,
                [id]
            );
            return;
        }

        await pool.query('DELETE FROM delivery_orders WHERE id = $1', [id]);
    }

    async getCourierHistory(courierId, period = 'today') {
        const cols = await getDeliveryOrdersColumns();

        const timeExpr = cols.has('delivered_at')
            ? 'COALESCE(o.delivered_at, o.updated_at, o.created_at)'
            : (cols.has('updated_at') ? 'COALESCE(o.updated_at, o.created_at)' : 'o.created_at');

        const conditions = ['o.courier_id = $1'];
        const params = [courierId];

        if (cols.has('is_deleted')) {
            conditions.push('COALESCE(o.is_deleted, false) = false');
        }

        if (period === 'today') {
            conditions.push(`${timeExpr} >= date_trunc('day', NOW())`);
        } else if (period === 'week') {
            conditions.push(`${timeExpr} >= date_trunc('week', NOW())`);
        } else if (period === 'month') {
            conditions.push(`${timeExpr} >= date_trunc('month', NOW())`);
        }

        const deliveredAtExpr = cols.has('delivered_at') ? 'o.delivered_at' : 'NULL AS delivered_at';
        const updatedAtExpr = cols.has('updated_at') ? 'o.updated_at' : 'NULL AS updated_at';
        const deliveryFeeExpr = cols.has('delivery_fee') ? 'o.delivery_fee' : '0 AS delivery_fee';

        const query = `
            SELECT
                o.id,
                o.status,
                o.customer_name,
                o.customer_phone,
                o.delivery_address,
                ${deliveryFeeExpr},
                o.created_at,
                ${updatedAtExpr},
                ${deliveredAtExpr}
            FROM delivery_orders o
            WHERE ${conditions.join(' AND ')}
            ORDER BY ${timeExpr} DESC, o.id DESC
            LIMIT 500
        `;

        const result = await pool.query(query, params);
        return result.rows || [];
    }

    async addHistory(orderId, status, userId, notes, latitude = null, longitude = null, client = pool) {
        const query = `
            INSERT INTO order_history (order_id, status, changed_by, notes, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(query, [orderId, status, userId, notes, latitude, longitude]);
    }
}

module.exports = new DeliveryRepository();
