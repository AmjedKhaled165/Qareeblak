const express = require('express');
const router = express.Router();
const db = require('../db');

// Create booking
router.post('/', async (req, res) => {
    try {
        const { userId, providerId, serviceId, userName, serviceName, providerName, price, details } = req.body;

        if (!providerId || !userName || !serviceName || !providerName) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        const result = await db.query(
            `INSERT INTO bookings 
             (user_id, provider_id, service_id, user_name, service_name, provider_name, price, details, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') 
             RETURNING id`,
            [userId, providerId, serviceId, userName, serviceName, providerName, price, details]
        );

        res.status(201).json({
            message: 'تم إنشاء الحجز بنجاح',
            id: result.rows[0].id.toString()
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'حدث خطأ في إنشاء الحجز' });
    }
});

// Get bookings by provider
router.get('/provider/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;

        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, status, details, booking_date
            FROM bookings
            WHERE provider_id = $1
            ORDER BY booking_date DESC
        `, [providerId]);

        const bookings = result.rows.map(b => ({
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name,
            providerName: b.provider_name,
            status: b.status,
            details: b.details,
            date: b.booking_date
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get provider bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

// Get bookings by user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, status, details, booking_date
            FROM bookings
            WHERE user_id = $1
            ORDER BY booking_date DESC
        `, [userId]);

        const bookings = result.rows.map(b => ({
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name,
            providerName: b.provider_name,
            status: b.status,
            details: b.details,
            date: b.booking_date
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة غير صالحة' });
        }

        await db.query(
            'UPDATE bookings SET status = $1 WHERE id = $2',
            [status, id]
        );

        res.json({ message: 'تم تحديث حالة الحجز بنجاح' });
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ error: 'حدث خطأ في تحديث الحجز' });
    }
});

// Get all bookings (for admin or general usage)
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, provider_id, status, details, booking_date
            FROM bookings
            ORDER BY booking_date DESC
        `);

        const bookings = result.rows.map(b => ({
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name,
            providerName: b.provider_name,
            providerId: b.provider_id?.toString(),
            status: b.status,
            details: b.details,
            date: b.booking_date
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

module.exports = router;
