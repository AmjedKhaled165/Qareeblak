const express = require('express');
const router = express.Router();
const db = require('../db');

// Create booking
router.post('/', async (req, res) => {
    try {
        const { userId, providerId, serviceId, userName, serviceName, providerName, price, details, items } = req.body;

        if (!providerId || !userName || !serviceName || !providerName) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        const result = await db.query(
            `INSERT INTO bookings 
             (user_id, provider_id, service_id, user_name, service_name, provider_name, price, details, items, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') 
             RETURNING id`,
            [userId, providerId, serviceId, userName, serviceName, providerName, price, details, JSON.stringify(items || [])]
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

// Get single booking with tracking info
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT b.*, 
                   d_o.status as halan_status, 
                   d_o.courier_id, 
                   u.name as courier_name, 
                   u.phone as courier_phone
            FROM bookings b
            LEFT JOIN delivery_orders d_o ON b.halan_order_id = d_o.id
            LEFT JOIN users u ON d_o.courier_id = u.id
            WHERE b.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الحجز غير موجود' });
        }

        const b = result.rows[0];
        console.log(`[Debug] GET Booking ${id}: Status=${b.status}, HalanStatus=${b.halan_status}, HalanID=${b.halan_order_id}`);

        // Smart Status: If Halan status is advanced, use it as the main status
        let effectiveStatus = b.status;
        const halan = b.halan_status;
        if (halan === 'picked_up' && effectiveStatus !== 'delivered') effectiveStatus = 'picked_up';
        if (halan === 'delivered') effectiveStatus = 'delivered';

        res.json({
            id: b.id.toString(),
            userId: b.user_id,
            userName: b.user_name,
            serviceName: b.service_name,
            providerName: b.provider_name,
            providerId: b.provider_id?.toString(),
            status: effectiveStatus, // Use smart status
            originalStatus: b.status,
            details: b.details,
            items: b.items,
            date: b.booking_date,
            updatedAt: b.updated_at,
            halanOrderId: b.halan_order_id,
            halanStatus: b.halan_status,
            courier: b.courier_id ? {
                id: b.courier_id,
                name: b.courier_name,
                phone: b.courier_phone
            } : null
        });
    } catch (error) {
        console.error('Get booking details error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات الحجز' });
    }
});

// Update booking (items, cancellation, etc.)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { items, status, halanOrderId } = req.body;

        const bookingResult = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ error: 'الحجز غير موجود' });
        }

        const booking = bookingResult.rows[0];
        const now = new Date();
        const bookingTime = new Date(booking.booking_date);
        const diffMinutes = Math.floor((now - bookingTime) / 60000);

        // Window check for cancellation/modification (limited to 5 mins)
        if (status === 'cancelled' || (items && !status)) {
            if (diffMinutes > 5 && booking.status === 'pending') {
                if (status === 'cancelled') {
                    return res.status(400).json({ error: 'انتهت فترة الـ 5 دقائق المسموح فيها بإلغاء الطلب' });
                }
            }

            if (booking.status !== 'pending' && status === 'cancelled') {
                return res.status(400).json({ error: 'لا يمكن إلغاء الطلب بعد قبوله من المطعم' });
            }
        }

        let query = 'UPDATE bookings SET updated_at = CURRENT_TIMESTAMP';
        const params = [];
        let paramIdx = 1;

        if (items) {
            query += `, items = $${paramIdx++}`;
            params.push(JSON.stringify(items));
        }
        if (status) {
            query += `, status = $${paramIdx++}`;
            params.push(status);
        }
        if (halanOrderId) {
            query += `, halan_order_id = $${paramIdx++}`;
            params.push(halanOrderId);
        }

        query += ` WHERE id = $${paramIdx++} RETURNING *`;
        params.push(id);

        const result = await db.query(query, params);

        // Emit socket event for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.emit('booking-updated', { id, status: status || result.rows[0].status });
        }

        if (items && booking.halan_order_id) {
            await db.query('UPDATE delivery_orders SET items = $1, is_edited = true WHERE id = $2', [JSON.stringify(items), booking.halan_order_id]);

            // Emit to Halan dash (Courier/Manager)
            if (io) {
                io.emit('order-updated', { orderId: booking.halan_order_id });
                console.log(`[Sync] Emitted order-updated for Halan #${booking.halan_order_id}`);
            }
        }

        // ==========================================
        // SYNC WITH DELIVERY ORDER (Auto-Assign if Confirmed/Completed)
        // ==========================================
        if (status) {
            // Re-fetch booking to get potentially updated halan_order_id if it was just set
            // or just use what we have. If halanOrderId was passed in body, it's now in DB.
            const updatedBookingResult = await db.query('SELECT halan_order_id, provider_id FROM bookings WHERE id = $1', [id]);

            if (updatedBookingResult.rows.length > 0 && updatedBookingResult.rows[0].halan_order_id) {
                const { performAutoAssign } = require('../utils/driver-assignment');
                const halanOrderId = updatedBookingResult.rows[0].halan_order_id;
                const providerId = updatedBookingResult.rows[0].provider_id;

                let halanStatus = null;
                if (status === 'confirmed') halanStatus = 'pending'; // Changed: Confirmed does NOT assign driver yet
                if (status === 'completed') halanStatus = 'ready_for_pickup'; // Ready -> Assign Driver
                if (status === 'cancelled') halanStatus = 'cancelled';

                if (halanStatus) {
                    // Special handling for 'completed' (Ready) -> Trigger Auto Assign
                    if (status === 'completed') {
                        // Check if already assigned
                        const orderCheck = await db.query('SELECT courier_id FROM delivery_orders WHERE id = $1', [halanOrderId]);
                        if (orderCheck.rows.length > 0 && !orderCheck.rows[0].courier_id) {
                            console.log(`[Booking - Generic Patch] Booking #${id} is Ready. Auto-assigning driver for Order #${halanOrderId}...`);
                            try {
                                const courier = await performAutoAssign(halanOrderId, providerId, io, 'ready_for_pickup');
                                if (courier) {
                                    console.log(`[Booking - Generic Patch] Assigned driver ${courier.name} to Order #${halanOrderId}`);
                                    halanStatus = null; // Prevent double update
                                }
                            } catch (e) {
                                console.error('[Booking - Generic Patch] Auto-assign failed:', e.message);
                            }
                        }
                    }

                    // If not handled by auto-assign
                    if (halanStatus) {
                        await db.query('UPDATE delivery_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [halanStatus, halanOrderId]);
                        if (io) io.emit('order-status-changed', { orderId: halanOrderId, status: halanStatus });
                    }
                }
            }
        }
        // ==========================================

        res.json({ message: 'تم التحديث بنجاح', booking: result.rows[0] });
    } catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json({ error: 'حدث خطأ في التحديث' });
    }
});

// Get bookings by provider
router.get('/provider/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;

        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, status, details, items, halan_order_id, booking_date
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
            items: b.items,
            halanOrderId: b.halan_order_id,
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
            SELECT id, user_name, service_name, provider_name, status, details, items, halan_order_id, booking_date
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
            items: b.items,
            halanOrderId: b.halan_order_id,
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

        const io = req.app.get('io');
        if (io) {
            io.emit('booking-updated', { id, status });
        }

        // ==========================================
        // SYNC WITH DELIVERY ORDER (Auto-Assign if Confirmed)
        // ==========================================
        const { performAutoAssign } = require('../utils/driver-assignment');

        // Check if there is a linked halan_order_id
        const bookingCheck = await db.query('SELECT halan_order_id, provider_id FROM bookings WHERE id = $1', [id]);
        if (bookingCheck.rows.length > 0 && bookingCheck.rows[0].halan_order_id) {
            const halanOrderId = bookingCheck.rows[0].halan_order_id;
            const providerId = bookingCheck.rows[0].provider_id;

            // STATUS MAPPING:
            // confirmed (Provider Accepted) -> 'assigned' (Find Driver)
            // completed (Provider Ready) -> 'ready_for_pickup' (Driver Notified)
            // cancelled -> 'cancelled'

            let halanStatus = null;
            if (status === 'confirmed') halanStatus = 'pending'; // Changed: Confirmed does NOT assign driver yet
            if (status === 'completed') halanStatus = 'ready_for_pickup'; // Ready -> Assign Driver
            if (status === 'cancelled') halanStatus = 'cancelled';

            if (halanStatus) {
                // Special handling for 'completed' (Ready) -> Trigger Auto Assign
                if (status === 'completed') {
                    // Check if already assigned
                    const orderCheck = await db.query('SELECT courier_id FROM delivery_orders WHERE id = $1', [halanOrderId]);
                    if (orderCheck.rows.length > 0 && !orderCheck.rows[0].courier_id) {
                        console.log(`[Booking] Booking #${id} is Ready. Auto-assigning driver for Order #${halanOrderId}...`);
                        try {
                            // Target status 'ready_for_pickup' because it is ready!
                            const courier = await performAutoAssign(halanOrderId, providerId, io, 'ready_for_pickup');
                            if (courier) {
                                console.log(`[Booking] Assigned driver ${courier.name} to Order #${halanOrderId}`);
                                halanStatus = null; // Prevent double update
                            }
                        } catch (e) {
                            console.error('[Booking] Auto-assign failed:', e.message);
                        }
                    }
                }

                // If not handled by auto-assign (e.g. status update only), update manually
                if (halanStatus) {
                    await db.query('UPDATE delivery_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [halanStatus, halanOrderId]);
                    if (io) io.emit('order-status-changed', { orderId: halanOrderId, status: halanStatus });
                }
            }
        }
        // ==========================================

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
            SELECT id, user_name, service_name, provider_name, provider_id, status, details, items, halan_order_id, booking_date
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
            items: b.items,
            halanOrderId: b.halan_order_id,
            date: b.booking_date
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

module.exports = router;
