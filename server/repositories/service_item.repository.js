const pool = require('../db');

class ServiceItemRepository {
    async create(providerId, data) {
        const query = `
            INSERT INTO services 
            (provider_id, name, description, price, image, has_offer, offer_type, 
             discount_percent, bundle_count, bundle_free_count, offer_end_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING id
        `;
        const offer = data.offer || {};
        const params = [
            providerId, data.name, data.description, data.price, data.image,
            !!data.offer, offer.type || null, offer.discountPercent || null,
            offer.bundleCount || null, offer.bundleFreeCount || null, offer.endDate || null
        ];
        const result = await pool.query(query, params);
        return result.rows[0].id;
    }

    async updateSecure(id, providerId, data, isAdmin = false) {
        const offer = data.offer || {};

        // Base query - only allow update if provider owns the service
        let query = `
            UPDATE services SET 
                name = COALESCE($1, name), 
                description = COALESCE($2, description), 
                price = COALESCE($3, price), 
                image = COALESCE($4, image),
                has_offer = $5, 
                offer_type = $6, 
                discount_percent = $7, 
                bundle_count = $8, 
                bundle_free_count = $9, 
                offer_end_date = $10
            WHERE id = $11
        `;

        const params = [
            data.name || null, data.description || null, data.price || null, data.image || null,
            !!data.offer, offer.type || null, offer.discountPercent || null,
            offer.bundleCount || null, offer.bundleFreeCount || null, offer.endDate || null,
            id
        ];

        if (!isAdmin) {
            query += ` AND provider_id = $12`;
            params.push(providerId);
        }

        const result = await pool.query(query, params);
        return result.rowCount > 0;
    }

    async deleteSecure(id, providerId, isAdmin = false) {
        let query = 'DELETE FROM services WHERE id = $1';
        const params = [id];

        if (!isAdmin) {
            query += ' AND provider_id = $2';
            params.push(providerId);
        }

        const result = await pool.query(query, params);
        return result.rowCount > 0;
    }

    async getByProvider(providerId) {
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
}

module.exports = new ServiceItemRepository();
