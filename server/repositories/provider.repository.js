const pool = require('../db');

let providersColumnsCache = null;
let reviewsColumnsCache = null;

async function getProvidersColumns() {
    if (providersColumnsCache) return providersColumnsCache;

    const colsResult = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'providers'`
    );

    providersColumnsCache = new Set(colsResult.rows.map((r) => r.column_name));
    return providersColumnsCache;
}

async function getReviewsColumns() {
    if (reviewsColumnsCache) return reviewsColumnsCache;

    const colsResult = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'reviews'`
    );

    reviewsColumnsCache = new Set(colsResult.rows.map((r) => r.column_name));
    return reviewsColumnsCache;
}

class ProviderRepository {
    /**
     * @param {{limit: number, lastId: number, lastRating: number, category: string}} options
     */
    async getProviders({ limit = 20, lastId, lastRating, category }) {
        try {
            const cols = await getProvidersColumns();

            // [ENTERPRISE PERFORMANCE] Cursor-based pagination using composite (rating, id)
            const params = [limit];
            const conditions = [];

            if (cols.has('is_approved')) {
                conditions.push('p.is_approved = TRUE');
            }
            if (cols.has('is_banned')) {
                conditions.push('p.is_banned = FALSE');
            }

            if (category && cols.has('category')) {
                params.push(category);
                conditions.push(`p.category = $${params.length}`);
            }

            if (lastRating !== undefined && lastId !== undefined && cols.has('rating')) {
                params.push(lastRating, lastId);
                const rIdx = params.length - 1;
                const iIdx = params.length;
                conditions.push(`(p.rating < $${rIdx} OR (p.rating = $${rIdx} AND p.id > $${iIdx}))`);
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const userIdSelect = cols.has('user_id') ? 'p.user_id' : 'NULL::bigint AS user_id';
            const ratingSelect = cols.has('rating') ? 'p.rating' : '0::numeric AS rating';
            const reviewsSelect = cols.has('reviews_count') ? 'p.reviews_count AS reviews' : '0::int AS reviews';
            const joinedDateSelect = cols.has('joined_date') ? 'p.joined_date' : 'NOW() AS joined_date';
            const orderBy = cols.has('rating') ? 'p.rating DESC, p.id ASC' : 'p.id ASC';

            const query = `
                SELECT
                    p.id, p.name, p.email, p.category, p.location, p.phone, ${userIdSelect},
                    ${ratingSelect}, ${reviewsSelect}, ${joinedDateSelect}
                FROM providers p
                ${whereClause}
                ORDER BY ${orderBy}
                LIMIT $1
            `;

            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            // If providers table is missing in a partial/legacy backup, fail gracefully.
            if (error && error.code === '42P01') {
                return [];
            }
            throw error;
        }
    }

    async getByIdWithDetails(id) {
        const cols = await getProvidersColumns();
        const reviewCols = await getReviewsColumns();
        const userIdSelect = cols.has('user_id') ? 'p.user_id' : 'NULL::bigint AS user_id';
        const ratingSelect = cols.has('rating') ? 'p.rating' : '0::numeric AS rating';
        const reviewsSelect = cols.has('reviews_count') ? 'p.reviews_count AS reviews' : '0::int AS reviews';
        const approvedSelect = cols.has('is_approved') ? 'p.is_approved' : 'TRUE AS is_approved';
        const joinedDateSelect = cols.has('joined_date') ? 'p.joined_date' : 'NOW() AS joined_date';
        const reviewUserNameSelect = reviewCols.has('user_name')
            ? 'user_name'
            : (reviewCols.has('customer_name') ? 'customer_name AS user_name' : "'عميل' AS user_name");
        const reviewRatingSelect = reviewCols.has('rating') ? 'rating' : '0::numeric AS rating';
        const reviewCommentSelect = reviewCols.has('comment') ? 'comment' : 'NULL::text AS comment';
        const reviewDateSelect = reviewCols.has('review_date')
            ? 'review_date'
            : (reviewCols.has('created_at') ? 'created_at AS review_date' : 'NOW() AS review_date');

        // Single provider details with limited aggregation is acceptable
        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, ${userIdSelect},
                ${ratingSelect}, ${reviewsSelect}, ${approvedSelect}, ${joinedDateSelect},
                COALESCE(
                    (SELECT json_agg(s.*) FROM services s WHERE s.provider_id = p.id),
                    '[]'::json
                ) as services_raw,
                COALESCE(
                    (SELECT json_agg(rev.*) FROM (
                        SELECT id, ${reviewUserNameSelect}, ${reviewRatingSelect}, ${reviewCommentSelect}, ${reviewDateSelect}
                        FROM reviews
                        WHERE provider_id = p.id
                        ORDER BY review_date DESC
                        LIMIT 50
                    ) rev),
                    '[]'::json
                ) as reviews_raw
            FROM providers p
            WHERE p.id = $1
        `, [id]);
        return result.rows[0];
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
        const reviewCols = await getReviewsColumns();
        const reviewUserNameSelect = reviewCols.has('user_name')
            ? 'user_name'
            : (reviewCols.has('customer_name') ? 'customer_name AS user_name' : "'عميل' AS user_name");
        const reviewRatingSelect = reviewCols.has('rating') ? 'rating' : '0::numeric AS rating';
        const reviewCommentSelect = reviewCols.has('comment') ? 'comment' : 'NULL::text AS comment';
        const reviewDateSelect = reviewCols.has('review_date')
            ? 'review_date'
            : (reviewCols.has('created_at') ? 'created_at AS review_date' : 'NOW() AS review_date');

        const result = await pool.query(`
            SELECT id, ${reviewUserNameSelect}, ${reviewRatingSelect}, ${reviewCommentSelect}, ${reviewDateSelect}
            FROM reviews
            WHERE provider_id = $1
            ORDER BY review_date DESC
        `, [providerId]);
        return result.rows;
    }

    async search(query) {
        const cols = await getProvidersColumns();
        const approvalCondition = cols.has('is_approved') ? 'is_approved = TRUE AND' : '';
        const categoryField = cols.has('category') ? 'category' : 'name';

        const result = await pool.query(`
            SELECT id, name, ${categoryField} AS category, phone
            FROM providers
            WHERE ${approvalCondition} (name ILIKE $1 OR ${categoryField} ILIKE $1)
            ORDER BY name ASC
            LIMIT 20
        `, [`%${query.trim()}%`]);
        return result.rows;
    }

    async getById(id) {
        const cols = await getProvidersColumns();
        const userIdSelect = cols.has('user_id') ? 'p.user_id' : 'NULL::bigint AS user_id';
        const ratingSelect = cols.has('rating') ? 'p.rating' : '0::numeric AS rating';
        const reviewsSelect = cols.has('reviews_count') ? 'p.reviews_count AS reviews' : '0::int AS reviews';
        const approvedSelect = cols.has('is_approved') ? 'p.is_approved' : 'TRUE AS is_approved';
        const joinedDateSelect = cols.has('joined_date') ? 'p.joined_date' : 'NOW() AS joined_date';

        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, ${userIdSelect},
                ${ratingSelect}, ${reviewsSelect}, ${approvedSelect}, ${joinedDateSelect}
            FROM providers p
            WHERE p.id = $1
        `, [id]);
        return result.rows[0];
    }

    async getByEmail(email) {
        const cols = await getProvidersColumns();
        const ratingSelect = cols.has('rating') ? 'p.rating' : '0::numeric AS rating';
        const reviewsSelect = cols.has('reviews_count') ? 'p.reviews_count AS reviews' : '0::int AS reviews';
        const approvedSelect = cols.has('is_approved') ? 'p.is_approved' : 'TRUE AS is_approved';
        const joinedDateSelect = cols.has('joined_date') ? 'p.joined_date' : 'NOW() AS joined_date';

        const result = await pool.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone,
                ${ratingSelect}, ${reviewsSelect}, ${approvedSelect}, ${joinedDateSelect}
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
        const cols = await getProvidersColumns();

        // Primary mapping: providers.user_id -> users.id
        if (cols.has('user_id')) {
            const byUserId = await pool.query('SELECT id FROM providers WHERE user_id = $1 LIMIT 1', [userId]);
            if (byUserId.rows[0]?.id) return byUserId.rows[0].id;
        }

        // Fallback for legacy DBs where provider isn't linked by user_id yet.
        const userResult = await pool.query('SELECT email, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
        const user = userResult.rows[0];
        if (!user) return null;

        if (cols.has('email') && user.email) {
            const byEmail = await pool.query(
                'SELECT id FROM providers WHERE LOWER(email) = LOWER($1) LIMIT 1',
                [user.email]
            );
            if (byEmail.rows[0]?.id) return byEmail.rows[0].id;
        }

        if (cols.has('phone') && user.phone) {
            const byPhone = await pool.query('SELECT id FROM providers WHERE phone = $1 LIMIT 1', [user.phone]);
            if (byPhone.rows[0]?.id) return byPhone.rows[0].id;
        }

        return null;
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
