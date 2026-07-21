const pool = require('../db');
const vault = require('../utils/vault');
const logger = require('../utils/logger');
const { generateTrackingCode } = require('../utils/generate-tracking-code');

let deliveryOrdersColumnsCache = null;
let parentOrdersColumnsCache = null;

// [PERFORMANCE] Warm schema cache at startup — eliminates 1-2 extra round-trips per request
(async function warmColumnCache() {
    try {
        const [dResult, pResult] = await Promise.all([
            pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'delivery_orders'`),
            pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'parent_orders'`)
        ]);
        deliveryOrdersColumnsCache = new Set(dResult.rows.map(r => r.column_name));
        parentOrdersColumnsCache = new Set(pResult.rows.map(r => r.column_name));
    } catch (_) { /* server starting, schema not ready yet — will lazy-load on first real request */ }
})();

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
    if (typeof rawAddressInfo === 'string') {
        const trimmed = rawAddressInfo.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return JSON.parse(trimmed); } catch {}
        }
        const decrypted = vault.decrypt(rawAddressInfo);
        return safeJsonParse(decrypted);
    }
    return rawAddressInfo;
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

    // --- Address resolution ---
    // Try delivery_orders.delivery_address, then parent_order address_info,
    // then parse the linked booking's details text field.
    let resolvedAddress = '';
    if (!isPlaceholderAddress(row.delivery_address)) {
        resolvedAddress = row.delivery_address || '';
    } else if (addressFromParent) {
        resolvedAddress = addressFromParent;
    } else if (row.b_details) {
        // Parse "العنوان: xxx" from linked booking's details field
        const addrMatch = String(row.b_details).match(/العنوان[:\s]+([^|\n]+)/);
        if (addrMatch) resolvedAddress = addrMatch[1].trim();
    }

    const resolvedName = isPlaceholderName(row.customer_name)
        ? pickFirstValue([row.customer_user_name, nameFromParent, row.customer_name])
        : row.customer_name;
    const resolvedPhone = pickFirstValue([row.customer_phone, row.customer_user_phone, phoneFromParent]);

    // --- Items resolution ---
    let resolvedItems = [];
    if (row.items && typeof row.items === 'string') {
        resolvedItems = safeJsonParse(row.items) || [];
    } else if (Array.isArray(row.items)) {
        resolvedItems = row.items;
    }

    if (!Array.isArray(resolvedItems)) resolvedItems = [];

    // Fall back to items from sub_orders
    if (resolvedItems.length === 0 && Array.isArray(row.sub_orders) && row.sub_orders.length > 0) {
        row.sub_orders.forEach(sub => {
            const parsed = safeJsonParse(sub.items);
            if (Array.isArray(parsed)) {
                parsed.forEach(item => {
                    if (!item.provider_id && !item.providerId) {
                        item.provider_id = sub.provider_id;
                        item.provider_name = sub.provider_name;
                    }
                });
                resolvedItems.push(...parsed);
            }
        });
    } else if (resolvedItems.length === 0 && row.b_items) {
        const parsed = safeJsonParse(row.b_items);
        if (Array.isArray(parsed)) resolvedItems = parsed;
    }

    // --- Price resolution ---
    let resolvedPrice = Number(row.price || 0);
    if (resolvedPrice === 0 && Array.isArray(row.sub_orders) && row.sub_orders.length > 0) {
        resolvedPrice = row.sub_orders.reduce((sum, sub) => sum + (Number(sub.price) || 0), 0);
    } else if (resolvedPrice === 0 && row.b_price) {
        resolvedPrice = Number(row.b_price) || 0;
    }

    if (resolvedPrice === 0 && Array.isArray(resolvedItems) && resolvedItems.length > 0) {
        resolvedPrice = resolvedItems.reduce(
            (sum, item) => sum + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)),
            0
        );
    }

    return {
        ...row,
        customer_name: resolvedName,
        delivery_address: resolvedAddress,
        customer_phone: resolvedPhone,
        items: resolvedItems,
        price: resolvedPrice,
        delivery_fee: Number(row.delivery_fee || 0),
        sub_orders: row.sub_orders || []
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
    async getOrders({ role, userId, status, courierId, supervisorId, search, source, limit = 20, lastId, offset }) {
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
                conditions.push(`(
                    o.courier_id = $${params.length}
                    OR (
                        o.courier_id IS NULL AND EXISTS (
                            SELECT 1
                            FROM courier_supervisors cs
                            WHERE cs.courier_id = $${params.length}
                              AND cs.supervisor_id = o.supervisor_id
                        )
                    )
                )`);
            } else if (role === 'supervisor' || role === 'partner_supervisor') {
                params.push(userId);
                conditions.push(`(
                    o.supervisor_id = $${params.length}
                    OR (
                        o.supervisor_id IS NULL 
                        AND EXISTS (
                            SELECT 1
                            FROM courier_supervisors cs
                            WHERE cs.supervisor_id = $${params.length}
                              AND cs.courier_id = o.courier_id
                        )
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

        const hasIsDeleted = deliveryCols.has('is_deleted');
        const hasIsEdited = deliveryCols.has('is_modified_by_courier');

        if (status === 'deleted') {
            if (hasIsDeleted) conditions.push(`COALESCE(o.is_deleted, false) = true`);
            else conditions.push('1=0');
        } else if (status === 'edited') {
            const editCond = hasIsEdited ? `o.is_modified_by_courier = true` : '1=0';
            const delCond = hasIsDeleted ? `COALESCE(o.is_deleted, false) = false` : '1=1';
            conditions.push(`${editCond} AND ${delCond}`);
        } else {
            if (hasIsDeleted) conditions.push(`COALESCE(o.is_deleted, false) = false`);
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
        const parentJoin = hasParentAddressInfo ? 'LEFT JOIN parent_orders po ON po.id = bk.parent_order_id' : '';
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
                   ${parentAddressSelect},
                   bk.sub_orders
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${customerJoin}
            LEFT JOIN LATERAL (
                SELECT 
                    b.parent_order_id, 
                    jsonb_agg(
                        jsonb_build_object(
                            'id', b.id,
                            'status', b.status,
                            'provider_id', b.provider_id,
                            'provider_name', b.provider_name,
                            'items', b.items,
                            'price', b.price,
                            'details', b.details
                        ) ORDER BY b.id ASC
                    ) as sub_orders
                FROM bookings b
                WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
                GROUP BY b.parent_order_id
            ) bk ON TRUE
            ${parentJoin}
            ${whereClause}
            ORDER BY o.id DESC
            LIMIT $${params.length}
        `;

        const result = await pool.query(query, params);
        const rows = result.rows.reduce((acc, row) => {
            try {
                acc.push(hydrateOrderDisplayFields(row));
            } catch (e) {
                logger.error(`[getOrders] Skipping row #${row.id}: hydration failed — ${e.message}`);
            }
            return acc;
        }, []);

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
        const parentJoin = hasParentAddressInfo ? 'LEFT JOIN parent_orders po ON po.id = bk.parent_order_id' : '';
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
                   c.phone as courier_phone,
                   s.name as supervisor_name,
                   cu.name as customer_user_name,
                   cu.phone as customer_user_phone,
                   ${parentAddressSelect},
                   bk.sub_orders
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${customerJoin}
            LEFT JOIN LATERAL (
                SELECT 
                    MAX(b.parent_order_id) as parent_order_id, 
                    jsonb_agg(
                        jsonb_build_object(
                            'id', b.id,
                            'status', b.status,
                            'provider_id', b.provider_id,
                            'provider_name', b.provider_name,
                            'items', b.items,
                            'price', b.price,
                            'details', b.details
                        ) ORDER BY b.id ASC
                    ) as sub_orders
                FROM bookings b
                WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
            ) bk ON TRUE
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
            conditions.push(`(
                o.courier_id = $2
                OR (
                    o.courier_id IS NULL AND EXISTS (
                        SELECT 1
                        FROM courier_supervisors cs
                        WHERE cs.courier_id = $2
                          AND cs.supervisor_id = o.supervisor_id
                    )
                )
            )`);
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
        const parentJoin = hasParentAddressInfo ? 'LEFT JOIN parent_orders po ON po.id = bk.parent_order_id' : '';
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
                   c.phone as courier_phone,
                   s.name as supervisor_name,
                   cu.name as customer_user_name,
                   cu.phone as customer_user_phone,
                   ${parentAddressSelect},
                   bk.sub_orders
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            ${customerJoin}
            LEFT JOIN LATERAL (
                SELECT 
                    MAX(b.parent_order_id) as parent_order_id, 
                    jsonb_agg(
                        jsonb_build_object(
                            'id', b.id,
                            'status', b.status,
                            'provider_id', b.provider_id,
                            'provider_name', b.provider_name,
                            'items', b.items,
                            'price', b.price,
                            'details', b.details
                        ) ORDER BY b.id ASC
                    ) as sub_orders
                FROM bookings b
                WHERE CAST(b.halan_order_id AS TEXT) = CAST(o.id AS TEXT)
            ) bk ON TRUE
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
        const trackingCode = data.trackingCode || generateTrackingCode();
        const query = `
            INSERT INTO delivery_orders 
            (order_number, customer_name, customer_phone, pickup_address, delivery_address,
             pickup_lat, pickup_lng, delivery_lat, delivery_lng,
             courier_id, supervisor_id, status, notes, delivery_fee, items, source, order_type,
             tracking_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (tracking_code) DO UPDATE SET tracking_code = EXCLUDED.tracking_code
            RETURNING *
        `;
        const params = [
            data.orderNumber, data.customerName, data.customerPhone, data.pickupAddress, data.deliveryAddress,
            data.pickupLat || data.pLat || null, data.pickupLng || data.pLng || null,
            data.deliveryLat || data.dLat || null, data.deliveryLng || data.dLng || null,
            data.courierId, data.supervisorId || null, data.status, data.notes, data.deliveryFee,
            JSON.stringify(data.items), data.effectiveSource || data.source, data.effectiveOrderType || data.orderType,
            trackingCode
        ];
        const result = await client.query(query, params);
        return result.rows[0];
    }

    async createParentOrder(data, client = pool) {
        const cols = await getParentOrdersColumns();
        const priceCol = cols.has('total_price') ? 'total_price' : (cols.has('total_amount') ? 'total_amount' : null);
        
        const insertCols = ['user_id', 'status'];
        const values = ['$1', '$2'];
        const params = [data.userId, 'pending'];
        
        if (priceCol) {
            params.push(data.totalPrice);
            insertCols.push(priceCol);
            values.push(`$${params.length}`);
        }
        
        if (cols.has('details')) {
            params.push(data.details);
            insertCols.push('details');
            values.push(`$${params.length}`);
        }
        
        if (cols.has('address_info')) {
            params.push(data.addressInfo);
            insertCols.push('address_info');
            values.push(`$${params.length}`);
        }

        const query = `
            INSERT INTO parent_orders (${insertCols.join(', ')})
            VALUES (${values.join(', ')})
            RETURNING id
        `;
        const res = await client.query(query, params);
        return res.rows[0].id;
    }

    async createSubBooking(data, client = pool) {
        let uName = data.userName;
        const bColsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='bookings'");
        const bCols = new Set(bColsRes.rows.map(r => r.column_name));
        
        const insertCols = ['user_id', 'provider_id', 'service_name', 'provider_name', 'price', 'status'];
        const params = [data.userId, data.providerId, data.serviceName, data.providerName, data.price, 'pending'];
        const values = ['$1', '$2', '$3', '$4', '$5', '$6'];
        
        if (bCols.has('user_name')) {
            params.push(uName);
            insertCols.push('user_name');
            values.push(`$${params.length}`);
        } else if (bCols.has('customer_name')) {
            params.push(uName);
            insertCols.push('customer_name');
            values.push(`$${params.length}`);
        }
        
        if (bCols.has('details')) {
            params.push(data.details);
            insertCols.push('details');
            values.push(`$${params.length}`);
        }
        
        if (bCols.has('items')) {
            params.push(JSON.stringify(data.items));
            insertCols.push('items');
            values.push(`$${params.length}`);
        }
        
        if (bCols.has('parent_order_id') && data.parentId) {
            params.push(data.parentId);
            insertCols.push('parent_order_id');
            values.push(`$${params.length}`);
        }
        
        if (bCols.has('halan_order_id') && (data.deliveryOrderId || data.halanOrderId)) {
            params.push(data.deliveryOrderId || data.halanOrderId);
            insertCols.push('halan_order_id');
            values.push(`$${params.length}`);
        }

        const query = `
            INSERT INTO bookings (${insertCols.join(', ')})
            VALUES (${values.join(', ')})
            RETURNING id
        `;
        const res = await client.query(query, params);
        return res.rows[0].id;
    }

    async getUserInfo(userId, client = pool) {
        if (!userId) return null;
        const result = await client.query('SELECT id, name, email, role, user_type FROM users WHERE id = $1', [userId]);
        return result.rows[0] || null;
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
        return result.rows[0] ? hydrateOrderDisplayFields(result.rows[0]) : null;
    }

    async syncEditsToBookingsAndParent(orderId, updatedData) {
        if (!updatedData.items && !updatedData.customer_name && !updatedData.customer_phone && !updatedData.delivery_address && !updatedData.notes) return;

        const bookings = await this.getLinkedBookings(orderId);
        if (!bookings || bookings.length === 0) return;

        let parsedItems = null;
        if (updatedData.items) {
            try {
                parsedItems = typeof updatedData.items === 'string' ? JSON.parse(updatedData.items) : updatedData.items;
            } catch (e) {
                logger.error('Failed to parse updated items for sync', e);
            }
        }

        const bColsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='bookings'");
        const bCols = new Set(bColsRes.rows.map(r => r.column_name));

        for (const booking of bookings) {
            const updates = {};
            
            if (updatedData.customer_name) {
                if (bCols.has('user_name')) updates.user_name = updatedData.customer_name;
                else if (bCols.has('customer_name')) updates.customer_name = updatedData.customer_name;
            }

            if (parsedItems && bCols.has('items')) {
                let providerItems = [];
                if (bookings.length === 1) {
                    providerItems = parsedItems;
                } else {
                    providerItems = parsedItems.filter(item => Number(item.providerId) === Number(booking.provider_id) || Number(item.provider_id) === Number(booking.provider_id));
                }
                updates.items = JSON.stringify(providerItems);
                
                const newPrice = providerItems.reduce((sum, item) => sum + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)), 0);
                updates.price = newPrice;
            }

            if (Object.keys(updates).length > 0) {
                const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
                const params = Object.values(updates);
                params.push(booking.id);
                
                await pool.query(`UPDATE bookings SET ${setClause} WHERE id = $${params.length}`, params);
            }
        }

        if (parsedItems) {
            const parentIds = [...new Set(bookings.filter(b => b.parent_order_id).map(b => b.parent_order_id))];
            const pCols = await getParentOrdersColumns();
            const priceCol = pCols.has('total_price') ? 'total_price' : (pCols.has('total_amount') ? 'total_amount' : null);
            if (priceCol) {
                for (const parentId of parentIds) {
                    const pBookingsRes = await pool.query(`SELECT price FROM bookings WHERE parent_order_id = $1`, [parentId]);
                    const newTotalPrice = pBookingsRes.rows.reduce((sum, r) => sum + Number(r.price || 0), 0);
                    await pool.query(`UPDATE parent_orders SET ${priceCol} = $1 WHERE id = $2`, [newTotalPrice, parentId]);
                }
            }
        }
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
        if (Object.prototype.hasOwnProperty.call(updates, 'items') && cols.has('items')) {
            const itemsVal = typeof updates.items === 'string' ? updates.items : JSON.stringify(updates.items);
            push('items', itemsVal);
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'price') && cols.has('price')) {
            push('price', updates.price);
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
        return result.rows[0] ? hydrateOrderDisplayFields(result.rows[0]) : null;
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
            `SELECT COALESCE(bool_and(status IN ('ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'completed', 'confirmed', 'accepted')), true) AS all_ready
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

// Pre-warm column caches in the background
getDeliveryOrdersColumns().catch(e => logger.warn('Background cache warm failed (delivery orders)'));
getParentOrdersColumns().catch(e => logger.warn('Background cache warm failed (parent orders)'));

module.exports = new DeliveryRepository();
