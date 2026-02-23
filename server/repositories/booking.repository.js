const pool = require('../db');

class BookingRepository {
    async beginTransaction() {
        const client = await pool.pool.connect();
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
        const query = `
            INSERT INTO parent_orders (user_id, total_price, discount_amount, prize_id, status, details, address_info)
            VALUES ($1, $2, $3, $4, 'pending', $5, $6)
            RETURNING id
        `;
        const params = [userId, finalPrice, discount, prizeId || null, detailsStr, addressJson];
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
        let query;
        let params;

        if (lastId) {
            query = `
                SELECT id, user_name as userName, service_name as serviceName, status, price, booking_date as date, appointment_date as appointmentDate, appointment_type as appointmentType, parent_order_id as parentOrderId
                FROM bookings
                WHERE provider_id = $1 AND id < $2
                ORDER BY id DESC
                LIMIT $3
            `;
            params = [providerId, lastId, limit];
        } else {
            query = `
                SELECT id, user_name as userName, service_name as serviceName, status, price, booking_date as date, appointment_date as appointmentDate, appointment_type as appointmentType, parent_order_id as parentOrderId
                FROM bookings
                WHERE provider_id = $1
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
        let query;
        let params;

        if (lastId) {
            query = `
                SELECT id, user_name as userName, service_name as serviceName, provider_name as providerName, provider_id as providerId, status, details, items, price, halan_order_id as halanOrderId, booking_date as date, bundle_id as bundleId, parent_order_id as parentOrderId, appointment_date as appointmentDate, appointment_type as appointmentType
                FROM bookings
                WHERE user_id = $1 AND id < $2
                ORDER BY id DESC
                LIMIT $3
            `;
            params = [userId, lastId, limit];
        } else {
            query = `
                SELECT id, user_name as userName, service_name as serviceName, provider_name as providerName, provider_id as providerId, status, details, items, price, halan_order_id as halanOrderId, booking_date as date, bundle_id as bundleId, parent_order_id as parentOrderId, appointment_date as appointmentDate, appointment_type as appointmentType
                FROM bookings
                WHERE user_id = $1
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
        const query = 'SELECT user_id, provider_id, parent_order_id, halan_order_id, service_name, status FROM bookings WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    async updateBookingStatusAndPrice(id, status, price) {
        let query = 'UPDATE bookings SET status = $1';
        const params = [status];

        if (price !== undefined) {
            query += ', price = $2';
            params.push(price);
        }
        query += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(id);

        return (await pool.query(query, params)).rows[0];
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
}

module.exports = new BookingRepository();
