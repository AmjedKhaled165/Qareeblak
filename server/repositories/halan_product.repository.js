const pool = require('../db');

class HalanProductRepository {
    async getAll() {
        const result = await pool.query('SELECT * FROM halan_products ORDER BY name ASC');
        return result.rows;
    }

    async create(name) {
        const check = await pool.query('SELECT id FROM halan_products WHERE name = $1', [name]);
        if (check.rows.length > 0) return null;
        const result = await pool.query('INSERT INTO halan_products (name) VALUES ($1) RETURNING *', [name]);
        return result.rows[0];
    }

    async delete(id) {
        await pool.query('DELETE FROM halan_products WHERE id = $1', [id]);
    }
}

module.exports = new HalanProductRepository();
