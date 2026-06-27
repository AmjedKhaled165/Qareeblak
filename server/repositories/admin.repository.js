const pool = require('../db');
const vault = require('../utils/vault');

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

        // [BI] Orders Per Hour (Last 24h)
        const hourlyOrders = await pool.query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM-DD HH24:00') as hour,
                COUNT(*) as count
            FROM bookings
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour ASC
        `);

        // [BI] Top 5 Providers by Revenue (Last 30 Days)
        const topProviders = await pool.query(`
            SELECT 
                p.id, p.name,
                COUNT(b.id) as total_orders,
                SUM(b.price) as total_revenue
            FROM providers p
            JOIN bookings b ON p.id = b.provider_id
            WHERE b.status = 'completed' AND b.created_at > NOW() - INTERVAL '30 days'
            GROUP BY p.id, p.name
            ORDER BY total_revenue DESC
            LIMIT 5
        `);

        // [BI] User Retention (Quick Cohort: Did users return?)
        const retention = await pool.query(`
            WITH first_orders AS (
                SELECT user_id, MIN(created_at) as first_order_date
                FROM bookings
                GROUP BY user_id
            ),
            returning_users AS (
                SELECT DISTINCT b.user_id
                FROM bookings b
                JOIN first_orders fo ON b.user_id = fo.user_id
                WHERE b.created_at > fo.first_order_date
            )
            SELECT 
                (SELECT COUNT(*) FROM first_orders) as total_customers,
                (SELECT COUNT(*) FROM returning_users) as total_returning
        `);

        // [BI] Heatmap Data (Orders per Area)
        const heatmap = await pool.query(`
            SELECT 
                SUBSTRING(details FROM 'Area: (.*)') as area,
                COUNT(*) as weight
            FROM bookings
            WHERE details LIKE '%Area:%'
            GROUP BY area
            ORDER BY weight DESC
            LIMIT 10
        `);

        const statusResult = await pool.query(`SELECT status, COUNT(*) as count FROM bookings GROUP BY status`);

        return {
            summary: stats.rows[0],
            bookingStats: statusResult.rows,
            hourlyOrders: hourlyOrders.rows,
            topProviders: topProviders.rows,
            retention: retention.rows[0],
            heatmap: heatmap.rows
        };
    }

    async getOrders({ status, type, search, limit, lastId }) {
        const params = [];
        const conditions = [];

        // Keyset Pagination: O(log N)
        if (lastId) {
            params.push(lastId);
            conditions.push(`b.id < $${params.length}`);
        }
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

        params.push(Math.min(limit, 100));
        const result = await pool.query(`
            SELECT b.id, b.status, b.price, b.created_at, b.order_type,
                cu.name as customer_name, cu.phone as customer_phone,
                pu.name as provider_name
            FROM bookings b
            LEFT JOIN users cu ON b.user_id = cu.id
            LEFT JOIN providers pu ON b.provider_id = pu.id
            ${whereClause}
            ORDER BY b.id DESC
            LIMIT $${params.length}
        `, params);

        const rows = result.rows;
        return {
            records: rows,
            nextLastId: rows.length > 0 ? rows[rows.length - 1].id : null,
            hasMore: rows.length === limit
        };
    }

    async getUsers({ type, search, banned, limit, lastId }) {
        const params = [];
        const conditions = [];

        // [ENTERPRISE] Keyset pagination replacing inefficient OFFSET
        if (lastId) {
            params.push(lastId);
            conditions.push(`u.id < $${params.length}`);
        }
        if (type) {
            params.push(type);
            conditions.push(`u.user_type = $${params.length}`);
        }
        if (banned === 'true') {
            conditions.push('u.is_banned = true');
        }
        if (search) {
            params.push(`%${search}%`);
            const idx = params.length;
            conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone ILIKE $${idx})`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        params.push(Math.min(limit, 100));
        const result = await pool.query(`
            SELECT u.id, u.name, u.email, u.phone, u.user_type, u.is_banned, u.created_at,
                   (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as total_bookings
            FROM users u
            ${whereClause}
            ORDER BY u.id DESC
            LIMIT $${params.length}
        `, params);

        return {
            records: result.rows,
            nextLastId: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null,
            hasMore: result.rows.length === limit
        };
    }

    async banUser(id, isBanned) {
        // [AUDIT] In production, this should be wrapped in an audit log call in the service layer
        await pool.query('UPDATE users SET is_banned = $1 WHERE id = $2', [isBanned, id]);
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

    async getAuditLogs({ action, userId, limit, lastId }) {
        const params = [];
        const conditions = [];

        // [ENTERPRISE] Keyset pagination for audit logs
        if (lastId) {
            params.push(lastId);
            conditions.push(`a.id < $${params.length}`);
        }
        if (action) {
            params.push(action);
            conditions.push(`a.action = $${params.length}`);
        }
        if (userId) {
            params.push(userId);
            conditions.push(`a.admin_id = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        params.push(Math.min(limit, 100));
        const result = await pool.query(`
            SELECT a.*, u.name as admin_name
            FROM audit_actions a
            LEFT JOIN users u ON a.admin_id = u.id
            ${whereClause}
            ORDER BY a.id DESC
            LIMIT $${params.length}
        `, params);

        return {
            records: result.rows,
            nextLastId: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null,
            hasMore: result.rows.length === limit
        };
    }

    async getProvidersPerformance({ limit = 50, lastId }) {
        const params = [limit];
        let where = '';
        if (lastId) {
            params.push(lastId);
            where = 'WHERE p.id < $2';
        }

        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.category, p.phone,
                COUNT(b.id) as order_count,
                COALESCE(SUM(b.price), 0) as total_revenue,
                MAX(b.created_at) as last_order_at
            FROM providers p
            LEFT JOIN bookings b ON p.id = b.provider_id
            ${where}
            GROUP BY p.id, p.name, p.category, p.phone
            ORDER BY p.id DESC
            LIMIT $1
        `, params);

        return {
            records: result.rows,
            nextLastId: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null,
            hasMore: result.rows.length === limit
        };
    }

    async getProviderDetailedOrders(providerId, { limit = 50, lastId }) {
        const params = [providerId, limit];
        let where = 'WHERE b.provider_id = $1';

        if (lastId) {
            params.push(lastId);
            where += ' AND b.id < $3';
        }

        const result = await pool.query(`
            SELECT 
                b.id, 
                b.user_name as "customerName", 
                u.phone as "customerPhone",
                b.service_name as "orderTitle",
                b.items, 
                b.price, 
                b.discount_amount,
                b.status, 
                b.booking_date as "date",
                b.parent_order_id as "parentOrderId"
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            ${where}
            ORDER BY b.id DESC
            LIMIT $2
        `, params);

        return {
            records: result.rows,
            pagination: {
                nextLastId: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null,
                hasMore: result.rows.length === limit
            }
        };
    }

    // 💸 NO MERCY FINANCE
    async getFinanceSummary() {
        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(price), 0) as total_gross_value,
                COALESCE(SUM(commission_amount), 0) as total_platform_commission,
                COALESCE(SUM(net_provider_amount), 0) as total_provider_earnings,
                COALESCE((SELECT SUM(amount) FROM payouts WHERE status = 'completed'), 0) as total_payouts_made,
                COALESCE((SELECT COUNT(*) FROM bookings WHERE status = 'completed' AND is_paid_to_provider = false), 0) as unpaid_bookings_count
            FROM bookings 
            WHERE status = 'completed'
        `);
        return result.rows[0];
    }

    async getProviderFinanceReport(providerId) {
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.commission_rate,
                COALESCE(SUM(b.price), 0) as lifetime_revenue,
                COALESCE(SUM(b.commission_amount), 0) as lifetime_commission,
                COALESCE(SUM(b.net_provider_amount), 0) as lifetime_earnings,
                COALESCE((SELECT SUM(net_provider_amount) FROM bookings WHERE provider_id = $1 AND status = 'completed' AND is_paid_to_provider = false), 0) as current_unpaid_balance
            FROM providers p
            LEFT JOIN bookings b ON p.id = b.provider_id AND b.status = 'completed'
            WHERE p.id = $1
            GROUP BY p.id, p.name
        `, [providerId]);
        return result.rows[0];
    }

    async createPayout(providerId, amount, method, reference) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const payoutResult = await client.query(`
                INSERT INTO payouts (provider_id, amount, payout_method, reference_number, status, processed_at)
                VALUES ($1, $2, $3, $4, 'completed', NOW())
                RETURNING id
            `, [providerId, amount, method, reference]);

            const payoutId = payoutResult.rows[0].id;

            await client.query(`
                UPDATE bookings 
                SET is_paid_to_provider = true, payout_id = $1
                WHERE provider_id = $2 AND status = 'completed' AND is_paid_to_provider = false
            `, [payoutId, providerId]);

            await client.query('COMMIT');
            return payoutId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getPayouts(limit = 50) {
        const result = await pool.query(`
            SELECT pay.*, p.name as provider_name 
            FROM payouts pay
            JOIN providers p ON pay.provider_id = p.id
            ORDER BY pay.created_at DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    }

    /**
     * Get a single booking (order) with full join data for admin detail view.
     * Joins delivery_orders to resolve delivery_address and delivery_fee when available.
     */
    async getOrderWithDetails(id) {
        const result = await pool.query(`
            SELECT 
                b.id,
                b.status,
                b.price,
                b.delivery_fee,
                b.notes,
                b.items,
                b.details,
                b.order_type,
                b.created_at,
                b.updated_at,
                b.halan_order_id,
                cu.name  AS customer_name,
                cu.phone AS customer_phone,
                pu.name  AS provider_name,
                pu.phone AS provider_phone,
                do.delivery_address,
                do.pickup_address,
                do.courier_id,
                uc.name  AS courier_name,
                uc.phone AS courier_phone,
                COALESCE(do.delivery_fee, b.delivery_fee, 0) AS delivery_fee,
                po.address_info AS parent_address_info
            FROM bookings b
            LEFT JOIN users  cu ON b.user_id    = cu.id
            LEFT JOIN providers pu ON b.provider_id = pu.id
            LEFT JOIN delivery_orders do ON CAST(do.id AS TEXT) = CAST(b.halan_order_id AS TEXT)
            LEFT JOIN users  uc ON do.courier_id = uc.id
            LEFT JOIN parent_orders po ON b.parent_order_id = po.id
            WHERE b.id = $1
            LIMIT 1
        `, [id]);

        if (!result.rows[0]) return null;

        const row = result.rows[0];

        // Parse items if stored as JSON string
        if (row.items && typeof row.items === 'string') {
            try { row.items = JSON.parse(row.items); } catch { row.items = []; }
        }
        if (!Array.isArray(row.items)) row.items = [];

        // Resolve delivery_address fallback: try parsing from 'details' text field
        if (!row.delivery_address && row.details) {
            const match = String(row.details).match(/العنوان[:\s]+([^\n|]+)/);
            if (match) row.delivery_address = match[1].trim();
        }
        // Handle placeholder address values like 'n/a', 'N/A', 'no address', 'بدون عنوان'
        const PLACEHOLDER_ADDRESSES = new Set(['n/a', 'na', 'no address', 'بدون عنوان']);
        if (row.delivery_address && PLACEHOLDER_ADDRESSES.has(String(row.delivery_address).trim().toLowerCase())) {
            row.delivery_address = '';
            if (row.details) {
                const match = String(row.details).match(/العنوان[:\s]+([^\n|]+)/);
                if (match) row.delivery_address = match[1].trim();
            }
        }

        // Final fallback: try parent_order address_info
        if (!row.delivery_address && row.parent_address_info) {
            try {
                const raw = row.parent_address_info;
                const parsed = typeof raw === 'string'
                    ? (raw.trim().startsWith('{') ? JSON.parse(raw) : JSON.parse(vault.decrypt(raw) || 'null'))
                    : raw;
                if (parsed) {
                    row.delivery_address = parsed.address || parsed.area || parsed.street || parsed.details || parsed.fullAddress || '';
                }
            } catch {}
        }

        return row;
    }

    /**
     * Get items array for a booking (separate from the main row for the details endpoint).
     * Items are stored as JSONB in bookings.items column.
     */
    async getBookingItems(id) {
        const result = await pool.query(
            `SELECT items FROM bookings WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (!result.rows[0]) return [];
        const raw = result.rows[0].items;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        try { return JSON.parse(raw); } catch { return []; }
    }

    /**
     * Generic update for bookings table. Only updates provided keys (whitelist enforced).
     */
    async updateBooking(id, updates) {
        const ALLOWED = new Set(['status', 'price', 'delivery_fee', 'notes', 'items', 'courier_id', 'provider_id']);
        const fields = Object.keys(updates).filter(k => ALLOWED.has(k));
        if (fields.length === 0) return;

        const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => {
            const v = updates[f];
            // Serialize arrays/objects to JSON for JSONB columns
            return (f === 'items' && typeof v !== 'string') ? JSON.stringify(v) : v;
        });

        await pool.query(
            `UPDATE bookings SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
            [id, ...values]
        );
    }

    /**
     * Replace the full items array on a booking atomically.
     */
    async replaceBookingItems(id, items) {
        await pool.query(
            `UPDATE bookings SET items = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(items), id]
        );
    }

    /**
     * Update user profile fields.
     */
    async updateUser(id, updates) {
        const ALLOWED = new Set(['name', 'phone', 'email', 'user_type', 'password']);
        const fields = Object.keys(updates).filter(k => ALLOWED.has(k));
        if (fields.length === 0) return;

        const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => updates[f]);

        await pool.query(
            `UPDATE users SET ${setClauses} WHERE id = $1`,
            [id, ...values]
        );
    }

    /**
     * Get a single user's full profile (with booking stats).
     */
    async getUserDetailed(id) {
        const result = await pool.query(`
            SELECT 
                u.*,
                (SELECT COUNT(*) FROM bookings WHERE user_id = u.id) as total_bookings,
                (SELECT COUNT(*) FROM bookings WHERE user_id = u.id AND status = 'completed') as completed_bookings
            FROM users u
            WHERE u.id = $1
            LIMIT 1
        `, [id]);
        return result.rows[0] || null;
    }

    /**
     * Get couriers available for assignment (used in the reassign dropdown).
     */
    async getAvailableCouriers() {
        const result = await pool.query(`
            SELECT 
                u.id, u.name, u.phone,
                COALESCE(u.name, u.email) AS name_ar,
                TRUE as is_available,
                (SELECT COUNT(*) FROM delivery_orders do 
                 WHERE do.courier_id = u.id AND do.status NOT IN ('delivered', 'cancelled')
                ) as active_orders
            FROM users u
            WHERE u.user_type IN ('partner_courier', 'courier')
              AND COALESCE(u.is_banned, false) = false
            ORDER BY u.name ASC
        `);
        return { couriers: result.rows };
    }
}

module.exports = new AdminRepository();

