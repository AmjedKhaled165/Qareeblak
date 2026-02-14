const express = require('express');
const router = express.Router();
const db = require('../db');
const { getCache, setCache } = require('../utils/redis-cache'); // We'll create this

// PERFORMANCE OPTIMIZED: Get all providers with ONE QUERY instead of N+1
router.get('/', async (req, res) => {
    try {
        // Try cache first (5 minute TTL for homepage data)
        const cacheKey = 'providers:all:with-services';
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // ONE MASSIVE QUERY - joins everything at database level
        const result = await db.query(`
            SELECT 
                p.id as provider_id,
                p.name as provider_name,
                p.email,
                p.category,
                p.location,
                p.phone,
                p.user_id,
                p.rating,
                p.reviews_count,
                p.is_approved,
                p.joined_date,
                -- Services (as JSON array)
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', s.id::text,
                        'name', s.name,
                        'description', s.description,
                        'price', s.price::numeric,
                        'image', s.image,
                        'has_offer', s.has_offer,
                        'offer_type', s.offer_type,
                        'discount_percent', s.discount_percent,
                        'bundle_count', s.bundle_count,
                        'bundle_free_count', s.bundle_free_count,
                        'offer_end_date', s.offer_end_date
                    )) FILTER (WHERE s.id IS NOT NULL),
                    '[]'::json
                ) as services,
                -- Reviews (as JSON array, latest 5 only for performance)
                COALESCE(
                    (
                        SELECT json_agg(review_data)
                        FROM (
                            SELECT jsonb_build_object(
                                'id', r.id::text,
                                'userName', r.user_name,
                                'rating', r.rating,
                                'comment', r.comment,
                                'date', r.review_date
                            ) as review_data
                            FROM reviews r
                            WHERE r.provider_id = p.id
                            ORDER BY r.created_at DESC
                            LIMIT 5
                        ) latest_reviews
                    ),
                    '[]'::json
                ) as reviews_list
            FROM providers p
            LEFT JOIN services s ON s.provider_id = p.id
            WHERE p.is_approved = TRUE
            GROUP BY p.id
            ORDER BY p.rating DESC, p.id ASC
        `);

        // Transform to match frontend expectations
        const providers = result.rows.map(row => ({
            id: row.provider_id.toString(),
            name: row.provider_name,
            email: row.email,
            category: row.category,
            location: row.location,
            phone: row.phone,
            userId: row.user_id?.toString(),
            rating: parseFloat(row.rating) || 0,
            reviews: row.reviews_count || 0,
            isApproved: row.is_approved,
            joinedDate: row.joined_date,
            services: row.services || [],
            reviewsList: row.reviews_list || []
        }));

        // Cache for 5 minutes
        await setCache(cacheKey, providers, 300);

        res.json(providers);
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب مقدمي الخدمة' });
    }
});

// PERFORMANCE: Search providers with proper index usage
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 1) {
            return res.json([]);
        }

        const cacheKey = `providers:search:${q.trim().toLowerCase()}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Uses idx_providers_category_approved index
        const result = await db.query(`
            SELECT id, name, category, phone
            FROM providers
            WHERE is_approved = TRUE 
            AND is_banned = FALSE
            AND (name ILIKE $1 OR category ILIKE $1)
            ORDER BY rating DESC -- Uses composite index
            LIMIT 20
        `, [`%${q.trim()}%`]);

        const results = result.rows.map(p => ({
            id: p.id.toString(),
            name: p.name,
            category: p.category,
            phone: p.phone
        }));

        // Cache search results for 2 minutes
        await setCache(cacheKey, results, 120);

        res.json(results);
    } catch (error) {
        console.error('Search providers error:', error);
        res.status(500).json({ error: 'حدث خطأ في البحث' });
    }
});

// PERFORMANCE: Get single provider with ONE QUERY
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const cacheKey = `provider:${id}:full`;
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // ONE QUERY with joins
        const result = await db.query(`
            SELECT 
                p.*,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', s.id,
                        'name', s.name,
                        'description', s.description,
                        'price', s.price,
                        'image', s.image,
                        'has_offer', s.has_offer,
                        'offer_type', s.offer_type,
                        'discount_percent', s.discount_percent
                    )) FILTER (WHERE s.id IS NOT NULL),
                    '[]'::json
                ) as services,
                COALESCE(
                    (
                        SELECT json_agg(review_data)
                        FROM (
                            SELECT jsonb_build_object(
                                'id', r.id,
                                'user_name', r.user_name,
                                'rating', r.rating,
                                'comment', r.comment,
                                'review_date', r.review_date
                            ) as review_data
                            FROM reviews r
                            WHERE r.provider_id = p.id
                            ORDER BY r.created_at DESC
                            LIMIT 20
                        ) provider_reviews
                    ),
                    '[]'::json
                ) as reviews_list
            FROM providers p
            LEFT JOIN services s ON s.provider_id = p.id
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'مقدم الخدمة غير موجود' });
        }

        const provider = result.rows[0];
        
        // Cache for 3 minutes
        await setCache(cacheKey, provider, 180);

        res.json(provider);
    } catch (error) {
        console.error('Get provider error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات مقدم الخدمة' });
    }
});

// Get provider by user email (for dashboard)
router.get('/by-email/:email', async (req, res) => {
    try {
        const { email } = req.params;

        const result = await db.query(`
            SELECT 
                p.*,
                json_agg(DISTINCT s.*) FILTER (WHERE s.id IS NOT NULL) as services
            FROM providers p
            LEFT JOIN services s ON s.provider_id = p.id
            JOIN users u ON u.id = p.user_id
            WHERE u.email = $1
            GROUP BY p.id
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'مقدم الخدمة غير موجود' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get provider by email error:', error);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// Post review
router.post('/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        const { userName, rating, comment } = req.body;

        if (!userName || !rating) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Insert review
            await client.query(
                `INSERT INTO reviews (provider_id, user_name, rating, comment) 
                 VALUES ($1, $2, $3, $4)`,
                [id, userName, rating, comment]
            );

            // Update provider rating (single atomic query)
            await client.query(`
                UPDATE providers
                SET 
                    rating = (
                        SELECT ROUND(AVG(rating)::numeric, 1)
                        FROM reviews
                        WHERE provider_id = $1
                    ),
                    reviews_count = (
                        SELECT COUNT(*)
                        FROM reviews
                        WHERE provider_id = $1
                    )
                WHERE id = $1
            `, [id]);

            await client.query('COMMIT');

            // Invalidate cache
            await setCache(`provider:${id}:full`, null, 0);
            await setCache('providers:all:with-services', null, 0);

            res.status(201).json({ message: 'تم إضافة التقييم بنجاح' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Post review error:', error);
        res.status(500).json({ error: 'حدث خطأ في إضافة التقييم' });
    }
});

// Delete provider
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM providers WHERE id = $1', [id]);

        // Invalidate cache
        await setCache(`provider:${id}:full`, null, 0);
        await setCache('providers:all:with-services', null, 0);

        res.json({ message: 'تم حذف مقدم الخدمة بنجاح' });
    } catch (error) {
        console.error('Delete provider error:', error);
        res.status(500).json({ error: 'حدث خطأ في حذف مقدم الخدمة' });
    }
});

module.exports = router;
