const pool = require('../db');

class DeliveryRepository {
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

    async getOrders({ role, userId, status, courierId, supervisorId, search, source, limit, offset }) {
        let query = `
            SELECT o.*, 
                   c.name as courier_name,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
        `;
        const params = [];
        const conditions = [];

        // Security: Mandatory filtering for non-admins
        const isAdmin = role === 'admin' || role === 'owner';

        if (!isAdmin) {
            if (role === 'courier' || role === 'partner_courier') {
                params.push(userId);
                conditions.push(`o.courier_id = $${params.length}`);
            } else if (role === 'supervisor' || role === 'partner_supervisor' || role === 'partner_owner') {
                params.push(userId);
                conditions.push(`o.supervisor_id = $${params.length}`);
            } else {
                // Return nothing for unauthorized or guest roles
                conditions.push('1=0');
            }
        }

        if (status === 'deleted') {
            conditions.push(`o.is_deleted = true`);
        } else if (status === 'edited') {
            conditions.push(`o.is_edited = true AND o.is_deleted = false`);
        } else {
            conditions.push(`o.is_deleted = false`);
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

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const countQuery = `SELECT COUNT(*) FROM delivery_orders o ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}`;
        const totalResult = await pool.query(countQuery, params);

        query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return { records: result.rows, total: parseInt(totalResult.rows[0].count) };
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
        let query = `
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            WHERE o.id = $1
        `;
        const params = [id];

        // Security: Mandatory filtering for non-admins
        const isAdmin = role === 'admin' || role === 'owner';

        if (!isAdmin) {
            if (role === 'courier' || role === 'partner_courier') {
                params.push(userId);
                query += ` AND o.courier_id = $${params.length}`;
            } else if (role === 'supervisor' || role === 'partner_supervisor' || role === 'partner_owner') {
                params.push(userId);
                query += ` AND o.supervisor_id = $${params.length}`;
            } else {
                // Deny access for unauthorized roles
                query += ` AND 1=0`;
            }
        }
        // System Admins/Owners get full access without extra AND clauses

        const result = await pool.query(query, params);
        return result.rows[0];
    }

    async getLinkedBookings(orderId) {
        const query = `
            SELECT id, provider_id, provider_name, status, items, price, parent_order_id
            FROM bookings b
            WHERE b.halan_order_id = $1
        `;
        const result = await pool.query(query, [orderId]);
        return result.rows;
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

    async createParentOrder(data, client = pool) {
        const query = `
            INSERT INTO parent_orders (user_id, total_price, status, details, address_info)
            VALUES ($1, $2, 'pending', $3, $4)
            RETURNING id
        `;
        const result = await client.query(query, [data.userId, data.totalPrice, data.details, data.addressInfo]);
        return result.rows[0].id;
    }

    async createSubBooking(data, client = pool) {
        const query = `
            INSERT INTO bookings 
            (user_id, provider_id, service_id, user_name, service_name, provider_name, 
             price, details, items, status, parent_order_id, halan_order_id)
            VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
            RETURNING id
        `;
        const params = [
            data.userId, data.providerId, data.userName, data.serviceName, data.providerName,
            data.price, data.details, JSON.stringify(data.items), data.parentId, data.deliveryOrderId
        ];
        const result = await client.query(query, params);
        return result.rows[0].id;
    }

    async updateOrder(id, data) {
        const fields = Object.keys(data);
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const params = Object.values(data);
        params.push(id);

        const query = `UPDATE delivery_orders SET ${setClause}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`;
        const result = await pool.query(query, params);
        return result.rows[0];
    }

    async addHistory(orderId, status, userId, notes, latitude = null, longitude = null) {
        const query = `
            INSERT INTO order_history (order_id, status, changed_by, notes, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await pool.query(query, [orderId, status, userId, notes, latitude, longitude]);
    }

    async softDelete(id) {
        await pool.query('UPDATE delivery_orders SET is_deleted = true, updated_at = NOW() WHERE id = $1', [id]);
    }

    async getUserInfo(id) {
        const result = await pool.query('SELECT name, phone, user_type FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }
}

module.exports = new DeliveryRepository();
