const pool = require('../db');

let bookingsColumnsCache = null;
let parentOrdersColumnsCache = null;

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
        const query = `
            INSERT INTO bookings 
            (user_id, provider_id, user_name, service_name, provider_name, price, discount_amount, details, items, status, parent_order_id, bundle_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
            RETURNING id
        `;
        const result = await client.query(query, paramsArray);
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

    async getBookingsByProvider(providerId, limit, lastId) {
        const cols = await getBookingsColumns();
        const userNameExpr = cols.has('user_name')
            ? 'b.user_name'
            : (cols.has('customer_name') ? 'b.customer_name' : `'عميل'`);
        const serviceNameExpr = cols.has('service_name') ? 'b.service_name' : `'خدمة'`;
        const dateExpr = cols.has('booking_date') ? 'b.booking_date' : 'b.created_at';
        const appointmentDateExpr = cols.has('appointment_date') ? 'b.appointment_date' : 'NULL';
        const appointmentTypeExpr = cols.has('appointment_type') ? 'b.appointment_type' : 'NULL';
        const parentOrderExpr = cols.has('parent_order_id') ? 'b.parent_order_id' : 'NULL';

        let query;
        let params;

        if (lastId) {
            query = `
                SELECT b.id,
                       ${userNameExpr} AS "userName",
                       ${serviceNameExpr} AS "serviceName",
                       b.status,
                       b.price,
                       ${dateExpr} AS date,
                       ${appointmentDateExpr} AS "appointmentDate",
                       ${appointmentTypeExpr} AS "appointmentType",
                       ${parentOrderExpr} AS "parentOrderId"
                FROM bookings b
                WHERE b.provider_id = $1 AND b.id < $2
                ORDER BY id DESC
                LIMIT $3
            `;
            params = [providerId, lastId, limit];
        } else {
            query = `
                SELECT b.id,
                       ${userNameExpr} AS "userName",
                       ${serviceNameExpr} AS "serviceName",
                       b.status,
                       b.price,
                       ${dateExpr} AS date,
                       ${appointmentDateExpr} AS "appointmentDate",
                       ${appointmentTypeExpr} AS "appointmentType",
                       ${parentOrderExpr} AS "parentOrderId"
                FROM bookings b
                WHERE b.provider_id = $1
                ORDER BY id DESC
                LIMIT $2
            `;
            params = [providerId, limit];
        }

        const result = await pool.query(query, params);
        // Remove COUNT(*) since it's an O(N) full index scan which breaks cursor performance benefits.
        // The frontend only needs to know if length < limit to stop querying.
        return { records: result.rows };
    }

    async getBookingsByUser(userId, limit, lastId) {
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
                WHERE b.user_id = $1 AND b.id < $2
                ORDER BY id DESC
                LIMIT $3
            `;
            params = [userId, lastId, limit];
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
                WHERE b.user_id = $1
                ORDER BY id DESC
                LIMIT $2
            `;
            params = [userId, limit];
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
        const params = [targetStatus, id];
        let query = 'UPDATE bookings SET status = $1';

        if (price !== undefined) {
            params.push(price);
            query += `, price = $${params.length}`;
        }

        query += `, updated_at = NOW() WHERE id = $2`;

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
        await pool.query(
            'UPDATE delivery_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [status, deliveryOrderId]
        );
    }

    async checkDeliveryOrderType(halanOrderId) {
        const result = await pool.query(
            'SELECT order_type, courier_id, source FROM delivery_orders WHERE id = $1',
            [halanOrderId]
        );
        return result.rows[0];
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
