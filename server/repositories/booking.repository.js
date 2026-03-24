const pool = require('../db');

let bookingsColumnsCache = null;
let parentOrdersColumnsCache = null;
let deliveryOrdersColumnsCache = null;
let usersColumnsCache = null;

async function getBookingsColumns() {
    if (bookingsColumnsCache) return bookingsColumnsCache;

    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'bookings'`
    );

    bookingsColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return bookingsColumnsCache;
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

async function getUsersColumns() {
    if (usersColumnsCache) return usersColumnsCache;

    const result = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'`
    );

    usersColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return usersColumnsCache;
}

class BookingRepository {
    async beginTransaction() {
        // pool is the Pool instance directly (db.js exports pool, not { pool })
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

    async getUnusedUserPrize(prizeId, userId, client = pool) {
        const query = `
            SELECT up.id, wp.prize_type, wp.prize_value, wp.provider_id, wp.name
            FROM user_prizes up
            JOIN wheel_prizes wp ON up.prize_id = wp.id
            WHERE up.id = $1 AND up.user_id = $2 AND up.is_used = FALSE
            FOR UPDATE OF up
        `;
        const result = await client.query(query, [prizeId, userId]);
        return result.rows[0];
    }

    async createParentOrder(userId, finalPrice, discount, prizeId, detailsStr, addressJson, client = pool) {
        const cols = await getParentOrdersColumns();
        const insertCols = [];
        const values = [];
        const params = [];

        const pushColumn = (column, value) => {
            insertCols.push(column);
            params.push(value);
            values.push(`$${params.length}`);
        };

        if (cols.has('user_id')) pushColumn('user_id', userId);

        if (cols.has('total_price')) {
            pushColumn('total_price', finalPrice);
        } else if (cols.has('total_amount')) {
            pushColumn('total_amount', finalPrice);
        }

        if (cols.has('discount_amount')) pushColumn('discount_amount', discount || 0);
        if (cols.has('prize_id')) pushColumn('prize_id', prizeId || null);
        if (cols.has('status')) pushColumn('status', 'pending');
        if (cols.has('details')) pushColumn('details', detailsStr || null);
        if (cols.has('address_info')) pushColumn('address_info', addressJson || null);

        const query = insertCols.length > 0
            ? `INSERT INTO parent_orders (${insertCols.join(', ')}) VALUES (${values.join(', ')}) RETURNING id`
            : 'INSERT INTO parent_orders DEFAULT VALUES RETURNING id';

        const result = await client.query(query, params);
        return result.rows[0].id;
    }

    async createBookingItem(paramsArray, client = pool) {
        const [
            userId,
            providerId,
            userName,
            serviceName,
            providerName,
            price,
            discountAmount,
            details,
            items,
            parentOrderId,
            bundleId
        ] = paramsArray;

        const cols = await getBookingsColumns();
        const insertCols = [];
        const values = [];
        const params = [];

        const pushColumn = (column, value) => {
            insertCols.push(column);
            params.push(value);
            values.push(`$${params.length}`);
        };

        if (cols.has('user_id')) pushColumn('user_id', userId);
        if (cols.has('provider_id')) pushColumn('provider_id', providerId);

        if (cols.has('user_name')) {
            pushColumn('user_name', userName);
        } else if (cols.has('customer_name')) {
            pushColumn('customer_name', userName);
        }

        if (cols.has('service_name')) pushColumn('service_name', serviceName);
        if (cols.has('provider_name')) pushColumn('provider_name', providerName);
        if (cols.has('price')) pushColumn('price', price);
        if (cols.has('discount_amount')) pushColumn('discount_amount', discountAmount || 0);
        if (cols.has('details')) pushColumn('details', details || null);
        if (cols.has('items')) pushColumn('items', items || '[]');
        if (cols.has('status')) pushColumn('status', 'pending');
        if (cols.has('parent_order_id')) pushColumn('parent_order_id', parentOrderId || null);
        if (cols.has('bundle_id')) pushColumn('bundle_id', bundleId || null);

        const query = insertCols.length > 0
            ? `INSERT INTO bookings (${insertCols.join(', ')}) VALUES (${values.join(', ')}) RETURNING id`
            : 'INSERT INTO bookings DEFAULT VALUES RETURNING id';

        const result = await client.query(query, params);
        return result.rows[0].id;
    }

    async legacyCreateBooking(paramsArray) {
        const query = `
            INSERT INTO bookings 
             (user_id, provider_id, service_id, user_name, service_name, provider_name, price, details, items, status, bundle_id, appointment_date, appointment_type) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
             RETURNING id
        `;
        const result = await pool.query(query, paramsArray);
        return result.rows[0].id;
    }

    async markPrizeAsUsed(bookingId, prizeId, client = pool) {
        await client.query(
            'UPDATE user_prizes SET is_used = TRUE, used_at = CURRENT_TIMESTAMP, booking_id = $1 WHERE id = $2',
            [bookingId, prizeId]
        );
    }

    async createDeliveryOrderForBooking(bookingInfo) {
        let phone = '';
        if (bookingInfo.user_id) {
            const userRes = await pool.query('SELECT phone FROM users WHERE id = $1', [bookingInfo.user_id]);
            if (userRes.rows.length > 0) phone = userRes.rows[0].phone || '';
        }

        const orderNum = `HLN-${Date.now().toString(36).toUpperCase()}`;
        const itemsStr = typeof bookingInfo.items === 'string' ? bookingInfo.items : JSON.stringify(bookingInfo.items || []);
        const details = bookingInfo.details || '';
        
        let address = 'عنوان العميل';
        if (details.includes('العنوان:')) {
            const match = details.match(/العنوان:\s*([^|]+)/);
            if (match) address = match[1].trim();
        }

        const query = `
            INSERT INTO delivery_orders 
            (order_number, customer_name, customer_phone, delivery_address, status, notes, items, source, order_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        const params = [
            orderNum, bookingInfo.user_name || 'عميل Qareeblak', phone, address,
            'pending', details, itemsStr, 'qareeblak', 'app'
        ];

        const dResult = await pool.query(query, params);
        const newDOrderId = dResult.rows[0].id;

        await pool.query('UPDATE bookings SET halan_order_id = $1 WHERE id = $2', [newDOrderId, bookingInfo.id]);

        try {
            const { performAutoAssign } = require('../utils/driver-assignment');
            // 'assigned' targetStatus matches the normal checkout flow
            await performAutoAssign(newDOrderId, bookingInfo.user_id || 1, null, 'assigned');
        } catch (e) {
            console.error('AutoAssign failed for legacy booking', e);
        }

        return newDOrderId;
    }

    async getBookingsByProvider(providerId, limit, lastId, page = 1) {
        const cols = await getBookingsColumns();
        const deliveryCols = await getDeliveryOrdersColumns();
        const userCols = await getUsersColumns();
        const userNameExpr = cols.has('user_name')
            ? 'b.user_name'
            : (cols.has('customer_name') ? 'b.customer_name' : `'عميل'`);
        const serviceNameExpr = cols.has('service_name') ? 'b.service_name' : `'خدمة'`;
        const dateExpr = cols.has('booking_date') ? 'b.booking_date' : 'b.created_at';
        const appointmentDateExpr = cols.has('appointment_date') ? 'b.appointment_date' : 'NULL';
        const appointmentTypeExpr = cols.has('appointment_type') ? 'b.appointment_type' : 'NULL';
        const parentOrderExpr = cols.has('parent_order_id') ? 'b.parent_order_id' : 'NULL';
        const detailsExpr = cols.has('details') ? 'b.details' : 'NULL';
        const itemsExpr = cols.has('items') ? 'b.items' : "'[]'::text";
        const halanOrderExpr = cols.has('halan_order_id') ? 'b.halan_order_id' : 'NULL';
        const userIdExpr = cols.has('user_id') ? 'b.user_id' : 'NULL';

        const hasHalanOrder = cols.has('halan_order_id');
        const hasDeliveryCourier = deliveryCols.has('courier_id');
        const hasUsersPhone = userCols.has('phone');

        const courierIdExpr = (hasHalanOrder && hasDeliveryCourier) ? 'd.courier_id' : 'NULL';
        const courierNameExpr = (hasHalanOrder && hasDeliveryCourier) ? 'c.name' : 'NULL';
        const courierPhoneExpr = (hasHalanOrder && hasDeliveryCourier && hasUsersPhone) ? 'c.phone' : 'NULL';

        const joinDelivery = (hasHalanOrder && hasDeliveryCourier)
            ? 'LEFT JOIN delivery_orders d ON CAST(b.halan_order_id AS TEXT) = CAST(d.id AS TEXT) LEFT JOIN users c ON d.courier_id = c.id'
            : '';

        const userPhoneExpr = hasUsersPhone ? 'u.phone' : 'NULL';
        const joinUser = cols.has('user_id') ? 'LEFT JOIN users u ON CAST(b.user_id AS TEXT) = CAST(u.id AS TEXT)' : '';

        let query;
        let params;
        const offset = Math.max((Number(page) - 1) * Number(limit), 0);

        if (lastId) {
            query = `
                SELECT b.id,
                      ${userIdExpr} AS "userId",
                       ${userNameExpr} AS "userName",
                       ${serviceNameExpr} AS "serviceName",
                       b.status,
                       b.price,
                      ${detailsExpr} AS details,
                      ${itemsExpr} AS items,
                      ${halanOrderExpr} AS "halanOrderId",
                       ${courierIdExpr} AS "courierId",
                       ${courierNameExpr} AS "courierName",
                       ${courierPhoneExpr} AS "courierPhone",
                       ${userPhoneExpr} AS "userPhone",
                       ${dateExpr} AS date,
                       ${appointmentDateExpr} AS "appointmentDate",
                       ${appointmentTypeExpr} AS "appointmentType",
                       ${parentOrderExpr} AS "parentOrderId"
                FROM bookings b
                ${joinDelivery}
                ${joinUser}
                WHERE CAST(b.provider_id AS TEXT) = $1 AND b.id < $2
                ORDER BY b.id DESC
                LIMIT $3
            `;
            params = [String(providerId), lastId, limit];
        } else {
            query = `
                SELECT b.id,
                      ${userIdExpr} AS "userId",
                       ${userNameExpr} AS "userName",
                       ${serviceNameExpr} AS "serviceName",
                       b.status,
                       b.price,
                      ${detailsExpr} AS details,
                      ${itemsExpr} AS items,
                      ${halanOrderExpr} AS "halanOrderId",
                       ${courierIdExpr} AS "courierId",
                       ${courierNameExpr} AS "courierName",
                       ${courierPhoneExpr} AS "courierPhone",
                       ${userPhoneExpr} AS "userPhone",
                       ${dateExpr} AS date,
                       ${appointmentDateExpr} AS "appointmentDate",
                       ${appointmentTypeExpr} AS "appointmentType",
                       ${parentOrderExpr} AS "parentOrderId"
                FROM bookings b
                ${joinDelivery}
                ${joinUser}
                WHERE CAST(b.provider_id AS TEXT) = $1
                ORDER BY b.id DESC
                LIMIT $2
                OFFSET $3
            `;
            params = [String(providerId), limit, offset];
        }

        const result = await pool.query(query, params);
        // Remove COUNT(*) since it's an O(N) full index scan which breaks cursor performance benefits.
        // The frontend only needs to know if length < limit to stop querying.
        return { records: result.rows };
    }

    async getBookingsByUser(userId, limit, lastId, page = 1) {
        const cols = await getBookingsColumns();
        const userNameExpr = cols.has('user_name')
            ? 'b.user_name'
            : (cols.has('customer_name') ? 'b.customer_name' : `'عميل'`);
        const serviceNameExpr = cols.has('service_name') ? 'b.service_name' : `'خدمة'`;
        const providerNameExpr = cols.has('provider_name') ? 'b.provider_name' : `'مقدم خدمة'`;
        const dateExpr = cols.has('booking_date') ? 'b.booking_date' : 'b.created_at';
        const appointmentDateExpr = cols.has('appointment_date') ? 'b.appointment_date' : 'NULL';
        const appointmentTypeExpr = cols.has('appointment_type') ? 'b.appointment_type' : 'NULL';
        const bundleExpr = cols.has('bundle_id') ? 'b.bundle_id' : 'NULL';
        const parentOrderExpr = cols.has('parent_order_id') ? 'b.parent_order_id' : 'NULL';
        const halanOrderExpr = cols.has('halan_order_id') ? 'b.halan_order_id' : 'NULL';
        const itemsExpr = cols.has('items') ? 'b.items' : "'[]'::text";

        let query;
        let params;
        const offset = Math.max((Number(page) - 1) * Number(limit), 0);

        if (lastId) {
            query = `
                SELECT b.id,
                       ${userNameExpr} AS "userName",
                       ${serviceNameExpr} AS "serviceName",
                       ${providerNameExpr} AS "providerName",
                       b.provider_id AS "providerId",
                       b.status,
                       b.details,
                       ${itemsExpr} AS items,
                       b.price,
                       ${halanOrderExpr} AS "halanOrderId",
                       ${dateExpr} AS date,
                       ${bundleExpr} AS "bundleId",
                       ${parentOrderExpr} AS "parentOrderId",
                       ${appointmentDateExpr} AS "appointmentDate",
                       ${appointmentTypeExpr} AS "appointmentType"
                FROM bookings b
                WHERE CAST(b.user_id AS TEXT) = $1 AND b.id < $2
                ORDER BY id DESC
                LIMIT $3
            `;
            params = [String(userId), lastId, limit];
        } else {
            query = `
                SELECT b.id,
                       ${userNameExpr} AS "userName",
                       ${serviceNameExpr} AS "serviceName",
                       ${providerNameExpr} AS "providerName",
                       b.provider_id AS "providerId",
                       b.status,
                       b.details,
                       ${itemsExpr} AS items,
                       b.price,
                       ${halanOrderExpr} AS "halanOrderId",
                       ${dateExpr} AS date,
                       ${bundleExpr} AS "bundleId",
                       ${parentOrderExpr} AS "parentOrderId",
                       ${appointmentDateExpr} AS "appointmentDate",
                       ${appointmentTypeExpr} AS "appointmentType"
                FROM bookings b
                WHERE CAST(b.user_id AS TEXT) = $1
                ORDER BY id DESC
                LIMIT $2
                OFFSET $3
            `;
            params = [String(userId), limit, offset];
        }

        const result = await pool.query(query, params);
        return { records: result.rows };
    }

    async getBookingInfoById(id) {
        const query = `
            SELECT b.*,
                   p.name as "providerName", p.category as "providerCategory", p.user_id as "providerUserId",
                   u.phone as "providerPhone",
                   s.name as "serviceName", s.price as "servicePrice", s.image as "serviceImage"
            FROM bookings b
            LEFT JOIN providers p ON b.provider_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    async getBookingToUpdate(id) {
        // JOIN providers once to get providerUserId + commissionRate —
        // eliminates separate getUserIdByProviderId() and getProviderFinanceInfo() round-trips.
        const query = `
            SELECT b.user_id, b.provider_id, b.parent_order_id, b.halan_order_id,
                   b.service_name, b.status, b.price,
                   p.user_id AS "providerUserId",
                   COALESCE(p.commission_rate, 10.00) AS "commissionRate"
            FROM bookings b
            LEFT JOIN providers p ON b.provider_id = p.id
            WHERE b.id = $1
        `;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    async updateBookingStatusAtomic(id, expectedStatuses, targetStatus, price, client = pool) {
        // [ENTERPRISE] Compare-and-Swap Atomic Update
        const cols = await getBookingsColumns();
        const params = [targetStatus, id];
        let query = 'UPDATE bookings SET status = $1';

        if (price !== undefined) {
            params.push(price);
            query += `, price = $${params.length}`;
        }

        if (cols.has('updated_at')) {
            query += `, updated_at = NOW()`;
        }

        query += ` WHERE id = $2`;

        if (expectedStatuses) {
            const statusArray = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
            params.push(statusArray);
            query += ` AND status = ANY($${params.length})`;
        }

        query += ' RETURNING *';
        const result = await client.query(query, params);
        return result.rows[0];
    }

    async updateBookingStatusAndPrice(id, status, price) {
        return this.updateBookingStatusAtomic(id, null, status, price);
    }

    async updateDeliveryOrderStatus(deliveryOrderId, status) {
        const deliveryCols = await getDeliveryOrdersColumns();
        const setClauses = ['status = $1'];
        const params = [status, String(deliveryOrderId)];

        if (deliveryCols.has('updated_at')) {
            setClauses.push('updated_at = CURRENT_TIMESTAMP');
        }

        await pool.query(
            `UPDATE delivery_orders SET ${setClauses.join(', ')} WHERE CAST(id AS TEXT) = $2`,
            params
        );
    }

    async checkDeliveryOrderType(halanOrderId) {
        const deliveryCols = await getDeliveryOrdersColumns();
        const orderTypeExpr = deliveryCols.has('order_type') ? 'order_type' : 'NULL AS order_type';
        const courierIdExpr = deliveryCols.has('courier_id') ? 'courier_id' : 'NULL AS courier_id';
        const sourceExpr = deliveryCols.has('source') ? 'source' : 'NULL AS source';

        const result = await pool.query(
            `SELECT ${orderTypeExpr}, ${courierIdExpr}, ${sourceExpr}
             FROM delivery_orders
             WHERE CAST(id AS TEXT) = $1`,
            [String(halanOrderId)]
        );
        return result.rows[0];
    }

    async createDeliveryOrderForBooking(booking) {
        const bookingId = booking.id;
        const details = String(booking.details || '');

        const phoneMatch = details.match(/الهاتف:\s*([^|]+)/);
        const addressMatch = details.match(/العنوان:\s*([^|]+)/);

        const customerPhone = phoneMatch?.[1]?.trim() || '';
        const deliveryAddress = addressMatch?.[1]?.trim() || details || 'غير محدد';
        const customerName = booking.user_name || booking.customer_name || 'عميل Qareeblak';

        let itemsPayload = booking.items || [];
        if (typeof itemsPayload === 'string') {
            try {
                itemsPayload = JSON.parse(itemsPayload);
            } catch (e) {
                itemsPayload = [];
            }
        }

        const orderNumber = `HLN-BK-${bookingId}-${Date.now().toString(36).toUpperCase()}`;
        const result = await pool.query(
            `INSERT INTO delivery_orders
                (order_number, customer_name, customer_phone, pickup_address, delivery_address, status, notes, items, source, order_type, delivery_fee)
             VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
             RETURNING id`,
            [
                orderNumber,
                customerName,
                customerPhone,
                booking.provider_name || 'المتجر',
                deliveryAddress,
                'pending',
                details || `Linked from booking #${bookingId}`,
                JSON.stringify(Array.isArray(itemsPayload) ? itemsPayload : []),
                'qareeblak',
                'app',
                0
            ]
        );

        const halanOrderId = result.rows[0]?.id;
        if (!halanOrderId) return null;

        if (booking.parent_order_id) {
            await pool.query(
                'UPDATE bookings SET halan_order_id = $1 WHERE parent_order_id = $2',
                [halanOrderId, booking.parent_order_id]
            );
        } else {
            await pool.query(
                'UPDATE bookings SET halan_order_id = $1 WHERE id = $2',
                [halanOrderId, bookingId]
            );
        }

        return halanOrderId;
    }

    async rescheduleBooking(id, newDate, newStatus, lastUpdatedBy) {
        const result = await pool.query(
            'UPDATE bookings SET appointment_date = $1, status = $2, last_updated_by = $3 WHERE id = $4 RETURNING *',
            [newDate, newStatus, lastUpdatedBy, id]
        );
        return result.rows[0];
    }

    async confirmAppointment(id, acceptedBy) {
        const result = await pool.query(
            'UPDATE bookings SET status = $1, last_updated_by = $2 WHERE id = $3 RETURNING *',
            ['confirmed', acceptedBy, id]
        );
        return result.rows[0];
    }

    async getUserIdByProviderId(providerId) {
        const result = await pool.query('SELECT user_id FROM providers WHERE id = $1', [providerId]);
        return result.rows[0]?.user_id;
    }

    async getProviderFinanceInfo(providerId) {
        const result = await pool.query('SELECT commission_rate FROM providers WHERE id = $1', [providerId]);
        return result.rows[0];
    }

    async updateBookingFinancials(id, commission, net, client = pool) {
        await client.query(
            'UPDATE bookings SET commission_amount = $1, net_provider_amount = $2 WHERE id = $3',
            [commission, net, id]
        );
    }

    async incrementUserCancellation(userId) {
        await pool.query(
            'UPDATE users SET cancellation_count = cancellation_count + 1, last_cancellation_at = NOW() WHERE id = $1',
            [userId]
        );
    }
}

module.exports = new BookingRepository();
