const pool = require('../db');

class HalanProductRepository {
    async ensureTable() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS halan_products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
    }

    async getAll() {
        await this.ensureTable();
        const result = await pool.query('SELECT * FROM halan_products ORDER BY name ASC');
        return result.rows;
    }

    async create(name) {
        await this.ensureTable();
        const check = await pool.query('SELECT id FROM halan_products WHERE name = $1', [name]);
        if (check.rows.length > 0) return null;
        const result = await pool.query('INSERT INTO halan_products (name) VALUES ($1) RETURNING *', [name]);
        return result.rows[0];
    }

    async delete(id) {
        await this.ensureTable();
        await pool.query('DELETE FROM halan_products WHERE id = $1', [id]);
    }
}

module.exports = new HalanProductRepository();
