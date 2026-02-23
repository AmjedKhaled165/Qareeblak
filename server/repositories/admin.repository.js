const pool = require('../db');

class AdminRepository {
    async getDashboardStats() {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM providers) as total_providers,
                (SELECT COUNT(*) FROM bookings) as total_bookings,
                (SELECT SUM(price) FROM bookings WHERE status = 'completed') as total_revenue,
                (SELECT COUNT(*) FROM complaints WHERE status = 'pending') as pending_complaints
        `);
        const statusResult = await pool.query(`SELECT status, COUNT(*) as count FROM bookings GROUP BY status`);
        return { summary: stats.rows[0], bookingStats: statusResult.rows };
    }

    async getOrders({ status, type, search, sortCol, sortOrder, limit, offset }) {
        const params = [];
        const conditions = [];

        if (status) {
            params.push(status);
            conditions.push(`b.status = $${params.length}`);
        }
        if (type) {
            params.push(type);
            conditions.push(`b.order_type = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            const idx = params.length;
            conditions.push(`(cu.name ILIKE $${idx} OR cu.phone ILIKE $${idx} OR CAST(b.id AS TEXT) ILIKE $${idx})`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countQ = await pool.query(`SELECT COUNT(*) FROM bookings b LEFT JOIN users cu ON b.user_id = cu.id ${whereClause}`, params);

        const queryParams = [...params, limit, offset];
        const result = await pool.query(`
            SELECT b.*,
                cu.name as customer_name, cu.phone as customer_phone, cu.email as customer_email,
                pu.name as provider_name, pu.phone as provider_phone,
                cou.name as courier_name, cou.phone as courier_phone
            FROM bookings b
            LEFT JOIN users cu ON b.user_id = cu.id
            LEFT JOIN users pu ON b.provider_id = pu.id
            LEFT JOIN users cou ON b.courier_id = cou.id
            ${whereClause}
            ORDER BY ${sortCol} ${sortOrder}
            LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
        `, queryParams);

        return { records: result.rows, total: parseInt(countQ.rows[0].count) };
    }

    async getOrderWithDetails(id) {
        const result = await pool.query(`
            SELECT b.*,
                cu.name as customer_name, cu.phone as customer_phone, cu.email as customer_email,
                pu.name as provider_name, pu.phone as provider_phone,
                cou.name as courier_name, cou.phone as courier_phone
            FROM bookings b
            LEFT JOIN users cu ON b.user_id = cu.id
            LEFT JOIN users pu ON b.provider_id = pu.id
            LEFT JOIN users cou ON b.courier_id = cou.id
            WHERE b.id = $1
        `, [id]);
        return result.rows[0];
    }

    async getBookingItems(id) {
        try {
            const result = await pool.query('SELECT * FROM booking_items WHERE booking_id = $1', [id]);
            return result.rows;
        } catch (e) { return []; }
    }

    async updateBooking(id, data) {
        const fields = Object.keys(data);
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const params = [...Object.values(data), id];
        await pool.query(`UPDATE bookings SET ${setClause}, updated_at = NOW() WHERE id = $${params.length}`, params);
    }

    async replaceBookingItems(id, items) {
        try {
            await pool.query('DELETE FROM booking_items WHERE booking_id = $1', [id]);
            for (const item of items) {
                await pool.query(
                    'INSERT INTO booking_items (booking_id, name, quantity, price) VALUES ($1, $2, $3, $4)',
                    [id, item.name, item.quantity, item.price]
                );
            }
        } catch (e) { /* Table fallback */ }
    }

    async getUsers({ type, search, banned, limit, offset }) {
        const params = [];
        const conditions = [];
        if (type) { params.push(type); conditions.push(`u.user_type = $${params.length}`); }
        if (banned === 'true') conditions.push('u.is_banned = true');
        if (search) {
            params.push(`%${search}%`);
            const idx = params.length;
            conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone ILIKE $${idx})`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const countQ = await pool.query(`SELECT COUNT(*) FROM users u ${whereClause}`, params);

        const queryParams = [...params, limit, offset];
        const result = await pool.query(`
            SELECT u.id, u.name, u.name_ar, u.email, u.phone, u.user_type, u.is_banned, u.is_online, u.created_at,
                   (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as total_bookings
            FROM users u
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
        `, queryParams);

        return { records: result.rows, total: parseInt(countQ.rows[0].count) };
    }

    async getUserDetailed(id) {
        const result = await pool.query(`
            SELECT u.*, 
                   (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as total_bookings
            FROM users u WHERE u.id = $1
        `, [id]);
        return result.rows[0];
    }

    async banUser(id, isBanned) {
        await pool.query('UPDATE users SET is_banned = $1 WHERE id = $2', [isBanned, id]);
    }

    async updateUser(id, data) {
        const fields = Object.keys(data);
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const params = [...Object.values(data), id];
        await pool.query(`UPDATE users SET ${setClause} WHERE id = $${params.length}`, params);
    }

    async getAvailableCouriers() {
        const result = await pool.query(`
            SELECT u.id, u.name, u.phone, u.is_online,
                   (SELECT COUNT(*) FROM bookings WHERE courier_id = u.id AND status IN ('accepted', 'delivering', 'picked_up')) as active_orders
            FROM users u
            WHERE u.user_type = 'partner_courier'
              AND u.is_banned = false
            ORDER BY u.is_online DESC, u.name ASC
        `);
        return result.rows;
    }

    async logAction(data) {
        await pool.query(
            `INSERT INTO audit_actions (admin_id, action, entity_type, entity_id, details, old_value, new_value, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [data.adminId, data.action, data.entityType, data.entityId, data.details,
            data.oldValue ? JSON.stringify(data.oldValue) : null,
            data.newValue ? JSON.stringify(data.newValue) : null, data.ip]
        );
    }

    async getAuditLogs({ action, userId, dateFrom, limit, offset }) {
        const params = [];
        const conditions = [];
        if (action) { params.push(action); conditions.push(`a.action = $${params.length}`); }
        if (userId) { params.push(userId); conditions.push(`a.admin_id = $${params.length}`); }
        if (dateFrom) { params.push(dateFrom); conditions.push(`a.created_at >= $${params.length}::date`); }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const countQ = await pool.query(`SELECT COUNT(*) FROM audit_actions a ${whereClause}`, params);

        const queryParams = [...params, limit, offset];
        const result = await pool.query(`
            SELECT a.*, u.name as admin_name
            FROM audit_actions a
            LEFT JOIN users u ON a.admin_id = u.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
        `, queryParams);

        return { records: result.rows, total: parseInt(countQ.rows[0].count) };
    }
}

module.exports = new AdminRepository();
