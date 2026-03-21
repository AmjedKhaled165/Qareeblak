const pool = require('../db');

let servicesColumnsCache = null;

async function ensureServicesColumns() {
    await pool.query(`
        ALTER TABLE services
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS image TEXT,
        ADD COLUMN IF NOT EXISTS has_offer BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS offer_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS bundle_count INTEGER,
        ADD COLUMN IF NOT EXISTS bundle_free_count INTEGER,
        ADD COLUMN IF NOT EXISTS offer_end_date TIMESTAMP
    `);
}

async function getServicesColumns() {
    if (servicesColumnsCache) return servicesColumnsCache;

    // Keep legacy deployments compatible by self-healing missing service fields.
    await ensureServicesColumns();

    const colsResult = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'services'`
    );

    servicesColumnsCache = new Set(colsResult.rows.map((r) => r.column_name));
    return servicesColumnsCache;
}

class ServiceItemRepository {
    async create(providerId, data) {
        const cols = await getServicesColumns();
        const offer = data.offer || {};

        const insertCols = ['provider_id', 'name'];
        const params = [providerId, data.name];

        const pushIfExists = (col, value) => {
            if (!cols.has(col)) return;
            insertCols.push(col);
            params.push(value);
        };

        pushIfExists('description', data.description || null);
        pushIfExists('price', data.price ?? 0);
        pushIfExists('image', data.image || null);
        pushIfExists('has_offer', !!data.offer);
        pushIfExists('offer_type', offer.type || null);
        pushIfExists('discount_percent', offer.discountPercent || null);
        pushIfExists('bundle_count', offer.bundleCount || null);
        pushIfExists('bundle_free_count', offer.bundleFreeCount || null);
        pushIfExists('offer_end_date', offer.endDate || null);

        const placeholders = insertCols.map((_, idx) => `$${idx + 1}`).join(', ');
        const query = `
            INSERT INTO services (${insertCols.join(', ')})
            VALUES (${placeholders})
            RETURNING id
        `;
        const result = await pool.query(query, params);
        return result.rows[0].id;
    }

    async updateSecure(id, providerId, data, isAdmin = false) {
        const cols = await getServicesColumns();
        const offer = data.offer || {};

        const sets = [];
        const params = [];

        const pushSet = (col, value) => {
            if (!cols.has(col)) return;
            params.push(value);
            sets.push(`${col} = $${params.length}`);
        };

        if (data.name !== undefined) pushSet('name', data.name || null);
        if (data.description !== undefined) pushSet('description', data.description || null);
        if (data.price !== undefined) pushSet('price', data.price);
        if (data.image !== undefined) pushSet('image', data.image || null);

        // Keep offer fields in sync when provided
        if (data.offer !== undefined) {
            pushSet('has_offer', !!data.offer);
            pushSet('offer_type', offer.type || null);
            pushSet('discount_percent', offer.discountPercent || null);
            pushSet('bundle_count', offer.bundleCount || null);
            pushSet('bundle_free_count', offer.bundleFreeCount || null);
            pushSet('offer_end_date', offer.endDate || null);
        }

        if (sets.length === 0) {
            return true;
        }

        params.push(id);
        let query = `UPDATE services SET ${sets.join(', ')} WHERE id = $${params.length}`;

        if (!isAdmin) {
            params.push(providerId);
            query += ` AND provider_id = $${params.length}`;
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
        const cols = await getServicesColumns();

        const selectParts = [
            'id',
            cols.has('name') ? 'name' : 'NULL::text AS name',
            cols.has('description') ? 'description' : 'NULL::text AS description',
            cols.has('price') ? 'price' : '0::numeric AS price',
            cols.has('image') ? 'image' : 'NULL::text AS image',
            cols.has('has_offer') ? 'has_offer' : 'FALSE AS has_offer',
            cols.has('offer_type') ? 'offer_type' : 'NULL::text AS offer_type',
            cols.has('discount_percent') ? 'discount_percent' : 'NULL::numeric AS discount_percent',
            cols.has('bundle_count') ? 'bundle_count' : 'NULL::int AS bundle_count',
            cols.has('bundle_free_count') ? 'bundle_free_count' : 'NULL::int AS bundle_free_count',
            cols.has('offer_end_date') ? 'offer_end_date' : 'NULL::timestamp AS offer_end_date',
        ];

        const result = await pool.query(
            `SELECT ${selectParts.join(', ')} FROM services WHERE provider_id = $1`,
            [providerId]
        );
        return result.rows;
    }
}

module.exports = new ServiceItemRepository();
