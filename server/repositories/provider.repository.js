const pool = require('../db');

class ProviderRepository {
    async getAllApprovedWithDetails() {
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, p.user_id,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date,
                COALESCE(
                    (SELECT json_agg(s.*) FROM services s WHERE s.provider_id = p.id),
                    '[]'::json
                ) as services_raw,
                COALESCE(
                    (SELECT json_agg(rev.*) FROM (
                        SELECT id, user_name, rating, comment, review_date FROM reviews WHERE provider_id = p.id ORDER BY review_date DESC LIMIT 20
                    ) rev),
                    '[]'::json
                ) as reviews_raw
            FROM providers p
            WHERE p.is_approved = TRUE AND p.is_banned = FALSE
            ORDER BY p.rating DESC, p.id ASC
        `);
        return result.rows;
    }

    async getByIdWithDetails(id) {
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, p.user_id,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date,
                COALESCE(
                    (SELECT json_agg(s.*) FROM services s WHERE s.provider_id = p.id),
                    '[]'::json
                ) as services_raw,
                COALESCE(
                    (SELECT json_agg(rev.*) FROM (
                        SELECT id, user_name, rating, comment, review_date FROM reviews WHERE provider_id = p.id ORDER BY review_date DESC LIMIT 50
                    ) rev),
                    '[]'::json
                ) as reviews_raw
            FROM providers p
            WHERE p.id = $1
        `, [id]);
        return result.rows[0];
    }

    async getAllApproved() {
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, p.user_id,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date
            FROM providers p
            WHERE p.is_approved = TRUE
            ORDER BY p.id ASC
        `);
        return result.rows;
    }

    async getServices(providerId) {
        const result = await pool.query(`
            SELECT 
                id, name, description, price, image,
                has_offer, offer_type, discount_percent, 
                bundle_count, bundle_free_count, offer_end_date
            FROM services
            WHERE provider_id = $1
        `, [providerId]);
        return result.rows;
    }

    async getReviews(providerId) {
        const result = await pool.query(`
            SELECT id, user_name, rating, comment, review_date
            FROM reviews
            WHERE provider_id = $1
            ORDER BY review_date DESC
        `, [providerId]);
        return result.rows;
    }

    async search(query) {
        const result = await pool.query(`
            SELECT id, name, category, phone
            FROM providers
            WHERE is_approved = TRUE 
            AND (name ILIKE $1 OR category ILIKE $1)
            ORDER BY name ASC
            LIMIT 20
        `, [`%${query.trim()}%`]);
        return result.rows;
    }

    async getById(id) {
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, p.user_id,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date
            FROM providers p
            WHERE p.id = $1
        `, [id]);
        return result.rows[0];
    }

    async getByEmail(email) {
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date
            FROM providers p
            WHERE p.email = $1
        `, [email]);
        return result.rows[0];
    }

    async addReview(data) {
        await pool.query(
            `INSERT INTO reviews (provider_id, user_name, rating, comment) 
             VALUES ($1, $2, $3, $4)`,
            [data.providerId, data.userName, data.rating, data.comment]
        );
    }

    async deleteProvider(id) {
        const provider = await this.getById(id);
        if (!provider) return null;

        await pool.query('DELETE FROM providers WHERE id = $1', [id]);
        if (provider.user_id) {
            await pool.query('DELETE FROM users WHERE id = $1', [provider.user_id]);
        }
        return true;
    }

    async getProviderIdByUserId(userId) {
        const result = await pool.query('SELECT id FROM providers WHERE user_id = $1', [userId]);
        return result.rows[0]?.id;
    }

    async updateProvider(id, data) {
        const query = `
            UPDATE providers SET 
                name = COALESCE($1, name),
                category = COALESCE($2, category),
                location = COALESCE($3, location),
                phone = COALESCE($4, phone)
            WHERE id = $5
        `;
        const params = [data.name, data.category, data.location, data.phone, id];
        await pool.query(query, params);
    }
}

module.exports = new ProviderRepository();
