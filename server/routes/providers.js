const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all providers (with their services)
router.get('/', async (req, res) => {
    try {
        // Get all approved providers
        const providersResult = await db.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, p.user_id,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date
            FROM providers p
            WHERE p.is_approved = TRUE
            ORDER BY p.id ASC
        `);

        const providers = providersResult.rows;

        // For each provider, get their services and reviews
        for (let provider of providers) {
            // Get services
            const servicesResult = await db.query(`
                SELECT 
                    id, name, description, price, image,
                    has_offer, offer_type, discount_percent, 
                    bundle_count, bundle_free_count, offer_end_date
                FROM services
                WHERE provider_id = $1
            `, [provider.id]);

            provider.services = servicesResult.rows.map(s => ({
                id: s.id.toString(),
                name: s.name,
                description: s.description,
                price: parseFloat(s.price),
                image: s.image,
                offer: s.has_offer ? {
                    type: s.offer_type,
                    discountPercent: s.discount_percent,
                    bundleCount: s.bundle_count,
                    bundleFreeCount: s.bundle_free_count,
                    endDate: s.offer_end_date
                } : undefined
            }));

            // Get reviews
            const reviewsResult = await db.query(`
                SELECT id, user_name, rating, comment, review_date
                FROM reviews
                WHERE provider_id = $1
                ORDER BY review_date DESC
            `, [provider.id]);

            provider.reviewsList = reviewsResult.rows.map(r => ({
                id: r.id.toString(),
                userName: r.user_name,
                rating: r.rating,
                comment: r.comment,
                date: r.review_date
            }));

            // Convert id to string for frontend compatibility
            provider.id = provider.id.toString();
            provider.userId = provider.user_id?.toString();
            provider.isApproved = provider.is_approved;
            provider.joinedDate = provider.joined_date;
            delete provider.user_id;
            delete provider.is_approved;
            delete provider.joined_date;
        }

        res.json(providers);
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب مقدمي الخدمة' });
    }
});

// Search providers (lightweight for async dropdown)
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 1) {
            return res.json([]);
        }

        const result = await db.query(`
            SELECT id, name, category, phone
            FROM providers
            WHERE is_approved = TRUE 
            AND (name ILIKE $1 OR category ILIKE $1)
            ORDER BY name ASC
            LIMIT 20
        `, [`%${q.trim()}%`]);

        res.json(result.rows.map(p => ({
            id: p.id.toString(),
            name: p.name,
            category: p.category,
            phone: p.phone
        })));
    } catch (error) {
        console.error('Search providers error:', error);
        res.status(500).json({ error: 'حدث خطأ في البحث' });
    }
});

// Get provider by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const providerResult = await db.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone, p.user_id,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date
            FROM providers p
            WHERE p.id = $1
        `, [id]);

        if (providerResult.rows.length === 0) {
            return res.status(404).json({ error: 'مقدم الخدمة غير موجود' });
        }

        const provider = providerResult.rows[0];

        // Get services
        const servicesResult = await db.query(
            'SELECT * FROM services WHERE provider_id = $1',
            [id]
        );
        provider.services = servicesResult.rows;

        // Get reviews
        const reviewsResult = await db.query(
            'SELECT * FROM reviews WHERE provider_id = $1',
            [id]
        );
        provider.reviewsList = reviewsResult.rows;

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

        const providerResult = await db.query(`
            SELECT 
                p.id, p.name, p.email, p.category, p.location, p.phone,
                p.rating, p.reviews_count as reviews, p.is_approved, p.joined_date
            FROM providers p
            WHERE p.email = $1
        `, [email]);

        if (providerResult.rows.length === 0) {
            return res.status(404).json({ error: 'مقدم الخدمة غير موجود' });
        }

        const provider = providerResult.rows[0];

        // Get services
        const servicesResult = await db.query(`
            SELECT 
                id, name, description, price, image,
                has_offer, offer_type, discount_percent, 
                bundle_count, bundle_free_count, offer_end_date
            FROM services
            WHERE provider_id = $1
        `, [provider.id]);

        provider.services = servicesResult.rows.map(s => ({
            id: s.id.toString(),
            name: s.name,
            description: s.description,
            price: parseFloat(s.price),
            image: s.image,
            offer: s.has_offer ? {
                type: s.offer_type,
                discountPercent: s.discount_percent,
                bundleCount: s.bundle_count,
                bundleFreeCount: s.bundle_free_count,
                endDate: s.offer_end_date
            } : undefined
        }));

        // Get reviews
        const reviewsResult = await db.query(`
            SELECT id, user_name, rating, comment, review_date
            FROM reviews
            WHERE provider_id = $1
            ORDER BY review_date DESC
        `, [provider.id]);

        provider.reviewsList = reviewsResult.rows.map(r => ({
            id: r.id.toString(),
            userName: r.user_name,
            rating: r.rating,
            comment: r.comment,
            date: r.review_date
        }));

        provider.id = provider.id.toString();
        provider.isApproved = provider.is_approved;
        provider.joinedDate = provider.joined_date;

        res.json(provider);
    } catch (error) {
        console.error('Get provider by email error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات مقدم الخدمة' });
    }
});

// Add review to provider
router.post('/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        const { userName, rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });
        }

        // Insert review (Trigger trg_update_provider_rating will handles updating providers.rating and reviews_count)
        await db.query(
            `INSERT INTO reviews (provider_id, user_name, rating, comment) 
             VALUES ($1, $2, $3, $4)`,
            [id, userName || 'مجهول', rating, comment]
        );

        res.status(201).json({ message: 'تم إضافة التقييم بنجاح' });
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ error: 'حدث خطأ في إضافة التقييم' });
    }
});

// Delete provider (Admin)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get provider to find associated user
        const providerResult = await db.query('SELECT user_id FROM providers WHERE id = $1', [id]);

        if (providerResult.rows.length === 0) {
            return res.status(404).json({ error: 'مقدم الخدمة غير موجود' });
        }

        const userId = providerResult.rows[0].user_id;

        // Delete provider (cascades to services, reviews, bookings)
        await db.query('DELETE FROM providers WHERE id = $1', [id]);

        // Optionally delete user account too
        if (userId) {
            await db.query('DELETE FROM users WHERE id = $1', [userId]);
        }

        res.json({ message: 'تم حذف مقدم الخدمة بنجاح' });
    } catch (error) {
        console.error('Delete provider error:', error);
        res.status(500).json({ error: 'حدث خطأ في حذف مقدم الخدمة' });
    }
});

module.exports = router;
