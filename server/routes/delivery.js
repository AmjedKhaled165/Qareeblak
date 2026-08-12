const express = require('express');
const router = express.Router();
const { z } = require('zod');
const catchAsync = require('../utils/catchAsync');
const db = require('../db');
const logger = require('../utils/logger');
const { globalLimiter, checkoutLimiter } = require('../middleware/security');

// ======================================================
// PUBLIC: Customer-Facing Extra Service Order Submission
// Allows customers (guest or logged-in) to request extra
// services (utility card charging, rides, parcels).
// Does NOT require isPartnerOrAdmin — only rate limiting.
// ======================================================

const extraServiceSchema = z.object({
    customer_name: z.string().min(1, 'اسم العميل مطلوب'),
    customer_phone: z.string().min(10, 'رقم الهاتف غير صحيح').max(20),
    delivery_address: z.string().min(3, 'عنوان التوصيل مطلوب'),
    pickup_address: z.string().optional().default('موقع قريبلك - أسيوط الجديدة'),
    order_type: z.string().optional().default('extra_service'),
    source: z.string().optional().default('qareeblak_web'),
    delivery_fee: z.coerce.number().nonnegative().optional().default(20),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
        name_ar: z.string().min(1, 'اسم الخدمة مطلوب'),
        quantity: z.coerce.number().int().positive().default(1),
        unit_price: z.coerce.number().nonnegative().default(0),
        total_price: z.coerce.number().nonnegative().default(0),
        notes: z.string().optional().nullable(),
        extra_service_type: z.enum(['utility', 'ride', 'parcel']).optional(),
        utility_type: z.enum(['electricity', 'water', 'gas']).optional().nullable(),
        amount_specified: z.boolean().optional().default(false),
        charge_amount: z.coerce.number().nonnegative().optional().nullable(),
    })).min(1, 'يجب تحديد خدمة واحدة على الأقل'),
});

const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (error) {
        const issues = error.issues || error.errors || [];
        const messages = issues.map(e => e.message).join(', ');
        return res.status(400).json({ success: false, error: messages || 'بيانات غير صالحة', details: issues });
    }
};

/**
 * POST /api/delivery/orders
 * Public endpoint for customers to submit extra service requests.
 * Saves to bookings table with order_type = 'extra_service'.
 */
router.post('/orders', checkoutLimiter, globalLimiter, validate(extraServiceSchema), catchAsync(async (req, res) => {
    const {
        customer_name,
        customer_phone,
        delivery_address,
        pickup_address,
        order_type,
        source,
        delivery_fee,
        notes,
        items,
    } = req.body;

    const io = req.app.get('io');

    // Map items to the booking items format
    const mappedItems = items.map(item => ({
        name: item.name_ar,
        name_ar: item.name_ar,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
        notes: item.notes || undefined,
        extra_service_type: item.extra_service_type,
        utility_type: item.utility_type,
        amount_specified: item.amount_specified,
        charge_amount: item.charge_amount,
    }));

    const totalPrice = items.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0) + Number(delivery_fee || 0);
    const serviceTitle = items[0]?.name_ar || 'خدمة إضافية';

    // Insert into bookings table as an extra_service order
    const result = await db.query(
        `INSERT INTO bookings
            (user_name, service_name, provider_name, price, status, details, items, booking_date, order_type, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), $8, $9)
         RETURNING id`,
        [
            customer_name,
            serviceTitle,
            'قريبلك - خدمات إضافية',
            totalPrice,
            'pending',
            `${delivery_address} | هاتف: ${customer_phone} | ${notes || ''}`.trim().replace(/\|?\s*$/, ''),
            JSON.stringify(mappedItems),
            order_type || 'extra_service',
            source || 'qareeblak_web',
        ]
    );

    const bookingId = result.rows[0]?.id;

    logger.info(`[ExtraService] New order #${bookingId} created — ${serviceTitle} for ${customer_name} (${customer_phone})`);

    // Notify admin via socket if available
    if (io) {
        try {
            io.to('admin_room').emit('new_extra_service_order', {
                id: bookingId,
                service: serviceTitle,
                customer_name,
                customer_phone,
                delivery_address,
                notes,
            });
        } catch (_) {
            // Non-fatal — socket emit failure should not block response
        }
    }

    return res.status(201).json({
        success: true,
        id: bookingId,
        message: `تم إرسال طلب ${serviceTitle} بنجاح! سيتم التواصل معك قريباً 🚀`,
    });
}));

module.exports = router;
