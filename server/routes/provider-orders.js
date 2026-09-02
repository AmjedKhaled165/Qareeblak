const express = require('express');
const router = express.Router();
const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { verifyToken, isProviderOrAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

// ======================================================
// Provider-Initiated Orders
// Allows service providers to create orders directly
// from their dashboard (item name, price, quantity).
// The order appears instantly to Owner/Supervisor via Socket.io.
// ======================================================

router.use(verifyToken);

/**
 * POST /api/provider-orders
 * Create a new order initiated by the service provider.
 * Body: { items: [{ name, price, quantity }] }
 */
router.post('/', isProviderOrAdmin, catchAsync(async (req, res) => {
    const userId = req.user.id;
    const io = req.app.get('io');
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'يجب إضافة عنصر واحد على الأقل' });
    }

    // Validate each item
    for (const item of items) {
        if (!item.name || item.name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'اسم المنتج مطلوب' });
        }
        if (!item.price || Number(item.price) <= 0) {
            return res.status(400).json({ success: false, error: 'السعر يجب أن يكون أكبر من صفر' });
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
            return res.status(400).json({ success: false, error: 'الكمية يجب أن تكون أكبر من صفر' });
        }
    }

    // Find the provider profile for this user
    const providerResult = await db.query(
        'SELECT id, name, category FROM providers WHERE user_id = $1 LIMIT 1',
        [userId]
    );

    if (providerResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'لم يتم العثور على حساب مقدم الخدمة' });
    }

    const provider = providerResult.rows[0];
    const totalPrice = items.reduce((sum, item) =>
        sum + (Number(item.price) * Number(item.quantity || 1)), 0
    );

    const mappedItems = items.map(item => ({
        name: item.name.trim(),
        product_name: item.name.trim(),
        quantity: Number(item.quantity) || 1,
        price: Number(item.price),
        total: Number(item.price) * (Number(item.quantity) || 1)
    }));

    const serviceTitle = items.length === 1
        ? items[0].name.trim()
        : `${items.length} أصناف`;

    // Create booking with status 'confirmed' (provider created it, so it's already accepted)
    const bookingResult = await db.query(
        `INSERT INTO bookings
            (user_id, provider_id, user_name, service_name, provider_name, price, status, details, items, booking_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
         RETURNING id`,
        [
            userId,
            provider.id,
            provider.name, // Provider is the "customer" in this case (they initiated it)
            serviceTitle,
            provider.name,
            totalPrice,
            'confirmed', // Starts as confirmed since provider created it
            `طلب من مقدم الخدمة: ${provider.name}`,
            JSON.stringify(mappedItems)
        ]
    );

    const bookingId = bookingResult.rows[0].id;

    // Now create a delivery order in the Halan system so Owner/Supervisor can assign courier
    let deliveryOrderId = null;
    try {
        const orderNumber = `PRV-${Date.now().toString(36).toUpperCase()}`;
        const deliveryResult = await db.query(
            `INSERT INTO delivery_orders
                (order_number, customer_name, customer_phone, pickup_address, delivery_address,
                 status, notes, items, source, order_type, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, NOW(), NOW())
             RETURNING id`,
            [
                orderNumber,
                provider.name,
                '', // No customer phone for provider-initiated orders
                provider.name, // Pickup from the provider
                'يحدد لاحقاً', // Delivery address to be determined
                'pending',
                `طلب من مقدم الخدمة: ${provider.name}`,
                JSON.stringify(mappedItems),
                'qareeblak_web',
                'provider'
            ]
        );
        deliveryOrderId = deliveryResult.rows[0].id;

        // Link the delivery order to the booking
        await db.query(
            'UPDATE bookings SET halan_order_id = $1 WHERE id = $2',
            [deliveryOrderId, bookingId]
        );
    } catch (err) {
        logger.error(`[ProviderOrder] Failed to create delivery order for booking #${bookingId}:`, err.message);
        // Non-fatal: booking is still created even if delivery order fails
    }

    logger.info(`[ProviderOrder] New order #${bookingId} (delivery: ${deliveryOrderId}) created by provider ${provider.name} (user: ${userId})`);

    // Emit Socket.io events to notify Owner/Supervisor in real-time
    if (io) {
        try {
            // Broadcast to all connected partners (owner, supervisors, couriers)
            io.emit('new_booking', {
                id: bookingId,
                providerId: provider.id,
                providerName: provider.name,
                serviceName: serviceTitle,
                price: totalPrice,
                items: mappedItems,
                status: 'confirmed',
                source: 'provider_initiated',
                deliveryOrderId,
                createdAt: new Date().toISOString()
            });

            // Also emit to provider's own room for instant UI update
            io.to(`provider-${provider.id}`).emit('new_booking', {
                id: bookingId,
                providerId: provider.id,
                providerName: provider.name,
                serviceName: serviceTitle,
                price: totalPrice,
                items: mappedItems,
                status: 'confirmed',
                source: 'provider_initiated',
                deliveryOrderId,
                createdAt: new Date().toISOString()
            });

            // Emit order-updated for delivery order tracking
            if (deliveryOrderId) {
                io.emit('order-updated', {
                    orderId: deliveryOrderId,
                    status: 'pending',
                    updates: { status: 'pending' }
                });
            }
        } catch (err) {
            logger.warn('[ProviderOrder] Socket emit failed:', err.message);
        }
    }

    // Send notifications to all owners/supervisors
    try {
        const partners = await db.query(
            `SELECT id FROM users WHERE user_type IN ('partner_owner', 'admin', 'partner_supervisor') AND is_banned = false`
        );
        for (const partner of partners.rows) {
            await createNotification(
                partner.id,
                `طلب جديد من ${provider.name}: ${serviceTitle} — ${totalPrice} ج.م`,
                'provider_order',
                String(bookingId),
                io
            );
        }
    } catch (err) {
        logger.warn('[ProviderOrder] Failed to send partner notifications:', err.message);
    }

    return res.status(201).json({
        success: true,
        id: bookingId,
        deliveryOrderId,
        message: 'تم إنشاء الطلب بنجاح! 🎉'
    });
}));

/**
 * PATCH /api/provider-orders/:id/status
 * Update the status of a provider-initiated order.
 * Body: { status: 'preparing' | 'ready' }
 *   preparing = جاري التجهيز (maps to booking 'confirmed')
 *   ready = تم التجهيز (maps to booking 'completed')
 */
router.patch('/:id/status', isProviderOrAdmin, catchAsync(async (req, res) => {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const io = req.app.get('io');
    const { status } = req.body;

    if (!status || !['preparing', 'ready'].includes(status)) {
        return res.status(400).json({ success: false, error: 'الحالة غير صالحة. يجب أن تكون preparing أو ready' });
    }

    // Fetch the booking
    const bookingResult = await db.query(
        'SELECT id, provider_id, halan_order_id, status as current_status, provider_name, service_name, price FROM bookings WHERE id = $1',
        [bookingId]
    );

    if (bookingResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    const booking = bookingResult.rows[0];

    // Map provider-friendly status to internal status
    let newBookingStatus;
    let newDeliveryStatus;
    let statusMessage;

    if (status === 'preparing') {
        newBookingStatus = 'confirmed';
        newDeliveryStatus = 'pending'; // Still pending for courier
        statusMessage = 'جاري التجهيز';
    } else if (status === 'ready') {
        newBookingStatus = 'completed';
        newDeliveryStatus = 'ready_for_pickup';
        statusMessage = 'تم التجهيز — جاهز للاستلام';
    }

    // Update booking status
    await db.query(
        'UPDATE bookings SET status = $1, last_updated_by = $2 WHERE id = $3',
        [newBookingStatus, 'provider', bookingId]
    );

    // Update delivery order status if exists
    if (booking.halan_order_id) {
        try {
            await db.query(
                'UPDATE delivery_orders SET status = $1, updated_at = NOW() WHERE id = $2',
                [newDeliveryStatus, booking.halan_order_id]
            );
        } catch (err) {
            logger.error(`[ProviderOrder] Failed to update delivery order #${booking.halan_order_id} status:`, err.message);
        }
    }

    logger.info(`[ProviderOrder] Order #${bookingId} status changed to ${status} (booking: ${newBookingStatus}, delivery: ${newDeliveryStatus}) by user ${userId}`);

    // Emit Socket.io events for real-time sync
    if (io) {
        try {
            // Broadcast to everyone about the status change
            io.emit('booking-updated', {
                id: Number(bookingId),
                bookingId: Number(bookingId),
                halanOrderId: booking.halan_order_id,
                status: newBookingStatus,
                providerStatus: status,
                providerName: booking.provider_name,
                serviceName: booking.service_name,
                statusMessage
            });

            io.emit('order-status-changed', {
                orderId: booking.halan_order_id || bookingId,
                bookingId: Number(bookingId),
                status: newDeliveryStatus,
                providerStatus: status,
                statusMessage
            });

            // Emit to provider room
            io.to(`provider-${booking.provider_id}`).emit('booking-updated', {
                id: Number(bookingId),
                bookingId: Number(bookingId),
                status: newBookingStatus,
                providerStatus: status,
                statusMessage
            });

            if (booking.halan_order_id) {
                io.emit('order-updated', {
                    orderId: booking.halan_order_id,
                    status: newDeliveryStatus,
                    updates: { status: newDeliveryStatus }
                });
            }
        } catch (err) {
            logger.warn('[ProviderOrder] Socket emit failed:', err.message);
        }
    }

    // Send notifications to partners
    try {
        const partners = await db.query(
            `SELECT id FROM users WHERE user_type IN ('partner_owner', 'admin', 'partner_supervisor', 'partner_courier') AND is_banned = false`
        );
        for (const partner of partners.rows) {
            await createNotification(
                partner.id,
                `${booking.provider_name}: ${statusMessage} — ${booking.service_name}`,
                'order_status',
                String(bookingId),
                io
            );
        }
    } catch (err) {
        logger.warn('[ProviderOrder] Failed to send status notifications:', err.message);
    }

    return res.status(200).json({
        success: true,
        message: statusMessage,
        status: newBookingStatus,
        deliveryStatus: newDeliveryStatus
    });
}));

module.exports = router;
