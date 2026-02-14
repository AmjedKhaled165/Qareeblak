const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isProviderOrAdmin } = require('../middleware/auth');

// Add service to provider
router.post('/', verifyToken, isProviderOrAdmin, async (req, res) => {
    try {
        const { providerId, name, description, price, image, offer } = req.body;

        if (!providerId || !name || !price) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        let hasOffer = false;
        let offerType = null;
        let discountPercent = null;
        let bundleCount = null;
        let bundleFreeCount = null;
        let offerEndDate = null;

        if (offer) {
            hasOffer = true;
            offerType = offer.type;
            discountPercent = offer.discountPercent;
            bundleCount = offer.bundleCount;
            bundleFreeCount = offer.bundleFreeCount;
            offerEndDate = offer.endDate || null;
        }

        const result = await db.query(
            `INSERT INTO services 
             (provider_id, name, description, price, image, has_offer, offer_type, discount_percent, bundle_count, bundle_free_count, offer_end_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING id`,
            [providerId, name, description, price, image, hasOffer, offerType, discountPercent, bundleCount, bundleFreeCount, offerEndDate]
        );

        res.status(201).json({
            message: 'تم إضافة الخدمة بنجاح',
            id: result.rows[0].id.toString()
        });
    } catch (error) {
        console.error('Add service error:', error);
        res.status(500).json({ error: 'حدث خطأ في إضافة الخدمة' });
    }
});

// Update service
router.put('/:id', verifyToken, isProviderOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, image, offer } = req.body;

        let hasOffer = false;
        let offerType = null;
        let discountPercent = null;
        let bundleCount = null;
        let bundleFreeCount = null;
        let offerEndDate = null;

        if (offer) {
            hasOffer = true;
            offerType = offer.type;
            discountPercent = offer.discountPercent;
            bundleCount = offer.bundleCount;
            bundleFreeCount = offer.bundleFreeCount;
            offerEndDate = offer.endDate || null;
        }

        await db.query(
            `UPDATE services SET 
             name = $1, description = $2, price = $3, image = $4,
             has_offer = $5, offer_type = $6, discount_percent = $7, 
             bundle_count = $8, bundle_free_count = $9, offer_end_date = $10
             WHERE id = $11`,
            [name, description, price, image, hasOffer, offerType, discountPercent, bundleCount, bundleFreeCount, offerEndDate, id]
        );

        res.json({ message: 'تم تعديل الخدمة بنجاح' });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ error: 'حدث خطأ في تعديل الخدمة' });
    }
});

// Delete service
router.delete('/:id', verifyToken, isProviderOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM services WHERE id = $1', [id]);

        res.json({ message: 'تم حذف الخدمة بنجاح' });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ error: 'حدث خطأ في حذف الخدمة' });
    }
});

// Get services by provider (PUBLIC - anonymous users need to browse services)
router.get('/provider/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;

        const result = await db.query(`
            SELECT 
                id, name, description, price, image,
                has_offer, offer_type, discount_percent, 
                bundle_count, bundle_free_count, offer_end_date
            FROM services
            WHERE provider_id = $1
        `, [providerId]);

        const services = result.rows.map(s => ({
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

        res.json(services);
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الخدمات' });
    }
});

module.exports = router;
