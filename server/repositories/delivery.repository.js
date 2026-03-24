const pool = require('../db');
const vault = require('../utils/vault');

let deliveryOrdersColumnsCache = null;
let parentOrdersColumnsCache = null;

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

async function getParentOrdersColumns() {
    if (parentOrdersColumnsCache) return parentOrdersColumnsCache;

    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'parent_orders'`
    );

    parentOrdersColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return parentOrdersColumnsCache;
}

const PLACEHOLDER_NAMES = new Set(['عميل qareeblak', 'qareeblak customer']);
const PLACEHOLDER_ADDRESSES = new Set(['بدون عنوان', 'no address', 'n/a']);

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function isPlaceholderName(value) {
    const normalized = normalizeText(value);
    return !normalized || PLACEHOLDER_NAMES.has(normalized) || normalized.includes('qareeblak');
}

function isPlaceholderAddress(value) {
    const normalized = normalizeText(value);
    return !normalized || PLACEHOLDER_ADDRESSES.has(normalized);
}

function safeJsonParse(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function parseAddressInfo(rawAddressInfo) {
    if (!rawAddressInfo) return null;
    const maybeDecrypted = typeof rawAddressInfo === 'string' ? vault.decrypt(rawAddressInfo) : rawAddressInfo;
    return safeJsonParse(maybeDecrypted);
}

function pickFirstValue(values) {
    for (const value of values) {
        const trimmed = String(value || '').trim();
        if (trimmed) return trimmed;
    }
    return '';
}

function buildAddressText(addressInfo) {
    if (!addressInfo || typeof addressInfo !== 'object') return '';

    const directAddress = pickFirstValue([
        addressInfo.address,
        addressInfo.street,
        addressInfo.fullAddress,
        addressInfo.location,
        addressInfo.formattedAddress,
        addressInfo.details
    ]);
    if (directAddress) return directAddress;

    const composed = [addressInfo.area, addressInfo.city, addressInfo.governorate]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' - ');
    return composed;
}

function hydrateOrderDisplayFields(row) {
    const addressInfo = parseAddressInfo(row.parent_address_info);

    const addressFromParent = buildAddressText(addressInfo);
    const nameFromParent = pickFirstValue([
        addressInfo?.name,
        addressInfo?.customerName,
        addressInfo?.recipientName,
        addressInfo?.fullName
    ]);
    const phoneFromParent = pickFirstValue([
        addressInfo?.phone,
        addressInfo?.mobile,
        addressInfo?.customerPhone
    ]);

    const resolvedName = isPlaceholderName(row.customer_name)
        ? pickFirstValue([row.customer_user_name, nameFromParent, row.customer_name])
        : row.customer_name;
    const resolvedAddress = isPlaceholderAddress(row.delivery_address)
        ? pickFirstValue([addressFromParent, row.delivery_address])
        : row.delivery_address;
    const resolvedPhone = pickFirstValue([row.customer_phone, row.customer_user_phone, phoneFromParent]);

    return {
        ...row,
        customer_name: resolvedName,
        delivery_address: resolvedAddress,
        customer_phone: resolvedPhone
    };
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
        const deliveryCols = await getDeliveryOrdersColumns();
        const parentCols = await getParentOrdersColumns();
        const hasCustomerId = deliveryCols.has('customer_id');
        const hasParentAddressInfo = parentCols.has('address_info');

        const params = [];
        const conditions = [];

        // Security: Mandatory filtering for non-admins
        // partner_owner should have owner-level visibility (all orders).
        const isAdmin = role === 'admin' || role === 'owner' || role === 'partner_owner';

        if (!isAdmin) {
            if (role === 'courier' || role === 'partner_courier') {
                params.push(userId);
                conditions.push(`o.courier_id = $${params.length}`);
            } else if (role === 'supervisor' || role === 'partner_supervisor') {
                params.push(userId);
                conditions.push(`(
                    o.supervisor_id = $${params.length}
                    OR EXISTS (
                        SELECT 1
                        FROM courier_supervisors cs
                        WHERE cs.supervisor_id = $${params.length}
                          AND cs.courier_id = o.courier_id
                    )
                )`);
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
        const customerJoin = hasCustomerId
            ? 'LEFT JOIN users cu ON o.customer_id = cu.id'
            : 'LEFT JOIN LATERAL (SELECT NULL::text as name, NULL::text as phone) cu ON TRUE';
        const parentJoin = hasParentAddressInfo ? 'LEFT JOIN parent_orders po ON po.id = b0.parent_order_id' : '';
        const parentAddressSelect = hasParentAddressInfo
            ? 'po.address_info as parent_address_info'
            : 'NULL::text as parent_address_info';

        const query = `
            SELECT o.*, 
                   COALESCE((
                       SELECT bool_and(b.status IN ('ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'completed'))
                       FROM bookings b
                       WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
                   ), true) AS providers_ready_for_pickup,
                   c.name as courier_name,
                   s.name as supervisor_name,
                   cu.name as customer_user_name,
                   cu.phone as customer_user_phone,
                   ${parentAddressSelect}
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${customerJoin}
            LEFT JOIN LATERAL (
                SELECT b.parent_order_id
                FROM bookings b
                WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
                ORDER BY b.id ASC
                LIMIT 1
            ) b0 ON TRUE
            ${parentJoin}
            ${whereClause}
            ORDER BY o.id DESC
            LIMIT $${params.length}
        `;

        const result = await pool.query(query, params);
        const rows = result.rows.map(hydrateOrderDisplayFields);

        return {
            records: rows,
            nextLastId: rows.length > 0 ? rows[rows.length - 1].id : null,
            hasMore: rows.length === limit
        };
    }

    async getOrderById(id) {
        const deliveryCols = await getDeliveryOrdersColumns();
        const parentCols = await getParentOrdersColumns();
        const hasCustomerId = deliveryCols.has('customer_id');
        const hasParentAddressInfo = parentCols.has('address_info');

        const customerJoin = hasCustomerId
            ? 'LEFT JOIN users cu ON o.customer_id = cu.id'
            : 'LEFT JOIN LATERAL (SELECT NULL::text as name, NULL::text as phone) cu ON TRUE';
        const parentJoin = hasParentAddressInfo ? 'LEFT JOIN parent_orders po ON po.id = b0.parent_order_id' : '';
        const parentAddressSelect = hasParentAddressInfo
            ? 'po.address_info as parent_address_info'
            : 'NULL::text as parent_address_info';

        const query = `
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone,
                   s.name as supervisor_name,
                   cu.name as customer_user_name,
                   cu.phone as customer_user_phone,
                   ${parentAddressSelect}
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${customerJoin}
            LEFT JOIN LATERAL (
                SELECT b.parent_order_id
                FROM bookings b
                WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
                ORDER BY b.id ASC
                LIMIT 1
            ) b0 ON TRUE
            ${parentJoin}
            WHERE o.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0] ? hydrateOrderDisplayFields(result.rows[0]) : null;
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
            conditions.push(`o.courier_id = $2`);
        } else if (isSupervisor) {
            params.push(userId);
            conditions.push(`(
                o.supervisor_id = $2
                OR EXISTS (
                    SELECT 1
                    FROM courier_supervisors cs
                    WHERE cs.supervisor_id = $2
                      AND cs.courier_id = o.courier_id
                )
            )`);
        } else {
            return null;
        }

        const deliveryCols = await getDeliveryOrdersColumns();
        const parentCols = await getParentOrdersColumns();
        const hasCustomerId = deliveryCols.has('customer_id');
        const hasParentAddressInfo = parentCols.has('address_info');

        const customerJoin = hasCustomerId
            ? 'LEFT JOIN users cu ON o.customer_id = cu.id'
            : 'LEFT JOIN LATERAL (SELECT NULL::text as name, NULL::text as phone) cu ON TRUE';
        const parentJoin = hasParentAddressInfo ? 'LEFT JOIN parent_orders po ON po.id = b0.parent_order_id' : '';
        const parentAddressSelect = hasParentAddressInfo
            ? 'po.address_info as parent_address_info'
            : 'NULL::text as parent_address_info';

        const query = `
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone,
                   s.name as supervisor_name,
                   cu.name as customer_user_name,
                   cu.phone as customer_user_phone,
                   ${parentAddressSelect}
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${customerJoin}
            LEFT JOIN LATERAL (
                SELECT b.parent_order_id
                FROM bookings b
                WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
                ORDER BY b.id ASC
                LIMIT 1
            ) b0 ON TRUE
            ${parentJoin}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1
        `;

        const result = await pool.query(query, params);
        return result.rows[0] ? hydrateOrderDisplayFields(result.rows[0]) : null;
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

    async getLinkedBookings(halanOrderId) {
        const result = await pool.query(
            'SELECT id, parent_order_id FROM bookings WHERE CAST(halan_order_id AS TEXT) = $1',
            [String(halanOrderId)]
        );
        return result.rows;
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

    async updateCourierPricing(id, updates, meta = {}) {
        const cols = await getDeliveryOrdersColumns();
        const setClauses = [];
        const params = [];

        const push = (expr, value) => {
            params.push(value);
            setClauses.push(`${expr} = $${params.length}`);
        };

        if (Object.prototype.hasOwnProperty.call(updates, 'delivery_fee') && cols.has('delivery_fee')) {
            push('delivery_fee', updates.delivery_fee);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'notes') && cols.has('notes')) {
            push('notes', updates.notes);
        }

        if (cols.has('courier_modifications')) {
            push('courier_modifications', JSON.stringify({
                changedBy: meta.changedBy || null,
                before: meta.before || null,
                after: meta.after || null,
                at: new Date().toISOString()
            }));
        }
        if (cols.has('is_modified_by_courier')) {
            setClauses.push('is_modified_by_courier = true');
        }
        if (cols.has('courier_modified_at')) {
            setClauses.push('courier_modified_at = NOW()');
        }
        if (cols.has('updated_at')) {
            setClauses.push('updated_at = NOW()');
        }

        if (setClauses.length === 0) {
            return this.getOrderById(id);
        }

        params.push(id);
        const query = `
            UPDATE delivery_orders
            SET ${setClauses.join(', ')}
            WHERE id = $${params.length}
            RETURNING *
        `;

        const result = await pool.query(query, params);
        return result.rows[0] || null;
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

    async areAllLinkedBookingsReady(orderId) {
        const result = await pool.query(
            `SELECT COALESCE(bool_and(status IN ('ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'completed')), true) AS all_ready
             FROM bookings
             WHERE CAST(halan_order_id AS TEXT) = CAST($1 AS TEXT)`,
            [String(orderId)]
        );

        return Boolean(result.rows?.[0]?.all_ready);
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
