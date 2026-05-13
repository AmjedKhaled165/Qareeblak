const pool = require('../db');

class HalanUserRepository {
    async assignCourier(courierId, supervisorId) {
        const check = await pool.query('SELECT 1 FROM courier_supervisors WHERE courier_id = $1 AND supervisor_id = $2', [courierId, supervisorId]);
        if (check.rows.length === 0) {
            await pool.query('INSERT INTO courier_supervisors (courier_id, supervisor_id) VALUES ($1, $2)', [courierId, supervisorId]);
        }
    }

    async unassignCourier(courierId, supervisorId) {
        await pool.query('DELETE FROM courier_supervisors WHERE courier_id = $1 AND supervisor_id = $2', [courierId, supervisorId]);
    }

    async getUsers({ role, supervisorId, currentUserId, currentUserRole }) {
        let query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.phone, u.avatar, u.user_type, u.is_available, u.created_at,
                array_agg(cs.supervisor_id) FILTER (WHERE cs.supervisor_id IS NOT NULL) as supervisor_ids
            FROM users u
            LEFT JOIN courier_supervisors cs ON u.id = cs.courier_id
            WHERE u.user_type IN ('partner_owner', 'partner_supervisor', 'partner_courier')
        `;
        const params = [];

        if (role) {
            const userType = role === 'courier' ? 'partner_courier' : role === 'supervisor' ? 'partner_supervisor' : role === 'owner' ? 'partner_owner' : null;
            if (userType) {
                params.push(userType);
                query += ` AND u.user_type = $${params.length}`;
            }
        }

        if (currentUserRole === 'supervisor' && role === 'courier') {
            params.push(currentUserId);
            query += ` AND EXISTS (SELECT 1 FROM courier_supervisors sub_cs WHERE sub_cs.courier_id = u.id AND sub_cs.supervisor_id = $${params.length})`;
        } else if (supervisorId) {
            params.push(parseInt(supervisorId));
            query += ` AND EXISTS (SELECT 1 FROM courier_supervisors sub_cs WHERE sub_cs.courier_id = u.id AND sub_cs.supervisor_id = $${params.length})`;
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC';
        const result = await pool.query(query, params);
        return result.rows;
    }

    async getById(id) {
        const result = await pool.query(`SELECT * FROM users WHERE id = $1 AND user_type LIKE 'partner_%'`, [id]);
        return result.rows[0];
    }

    async updateAvailability(id, isAvailable) {
        await pool.query('UPDATE users SET is_available = $1 WHERE id = $2', [isAvailable, id]);
    }

    async updateProfile(id, data) {
        const fields = Object.keys(data);
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const params = [...Object.values(data), id];
        const result = await pool.query(`UPDATE users SET ${setClause} WHERE id = $${params.length} RETURNING *`, params);
        return result.rows[0];
    }

    async deleteUser(id) {
        await pool.query('UPDATE delivery_orders SET courier_id = NULL WHERE courier_id = $1', [id]);
        await pool.query('UPDATE delivery_orders SET supervisor_id = NULL WHERE supervisor_id = $1', [id]);
        await pool.query('DELETE FROM courier_supervisors WHERE courier_id = $1 OR supervisor_id = $1', [id]);
        const result = await pool.query('DELETE FROM users WHERE id = $1 AND user_type LIKE \'partner_%\' RETURNING id', [id]);
        return result.rowCount > 0;
    }
}

module.exports = new HalanUserRepository();
