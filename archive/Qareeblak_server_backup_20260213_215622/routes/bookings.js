const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const { createNotification } = require('./notifications');
const { verifyToken } = require('../middleware/auth');

// Consolidated Checkout Endpoint
router.post('/checkout', verifyToken, async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const { userId, items, addressInfo } = req.body;
        // items is array of CartItem { id, name, price, quantity, providerId, providerName, image? }
        // addressInfo is object { area, details, phone }

        if (!userId || !items || items.length === 0) {
            throw new Error('Invalid checkout data');
        }

        const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // 1. Create Parent Order
        const parentRes = await client.query(`
            INSERT INTO parent_orders (user_id, total_price, status, details, address_info)
            VALUES ($1, $2, 'pending', $3, $4)
            RETURNING id
        `, [
            userId,
            totalPrice,
            addressInfo ? `Phone: ${addressInfo.phone} | Addr: ${addressInfo.area}` : 'No Address',
            JSON.stringify(addressInfo)
        ]);
        const parentId = parentRes.rows[0].id;

        // 2. Group items by Provider
        const grouped = {};
        items.forEach(item => {
            if (!grouped[item.providerId]) {
                grouped[item.providerId] = {
                    providerName: item.providerName,
                    items: []
                };
            }
            grouped[item.providerId].items.push(item);
        });

        // 3. Create Sub-Orders (Bookings)
        const bookingIds = [];
        const userRes = await client.query('SELECT name FROM users WHERE id = $1', [userId]);
        const userName = userRes.rows[0]?.name || 'Unknown User';

        for (const [providerId, group] of Object.entries(grouped)) {
            const providerTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const detailsStr = addressInfo
                ? `الهاتف: ${addressInfo.phone} | العنوان: ${addressInfo.area} - ${addressInfo.details}`
                : "تم الطلب من السلة";

            const bookingRes = await client.query(`
                INSERT INTO bookings 
                (user_id, provider_id, service_id, user_name, service_name, provider_name, price, details, items, status, parent_order_id, bundle_id)
                VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)
                RETURNING id
            `, [
                userId,
                providerId,
                userName,
                `طلب منتجات (${group.items.length} أصناف)`,
                group.providerName,
                providerTotal,
                detailsStr,
                JSON.stringify(group.items),
                parentId,
                `BUNDLE-${parentId}` // Keeping bundle_id for backward compat if needed
            ]);
            bookingIds.push(bookingRes.rows[0].id);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            parentId: parentId,
            bookingIds: bookingIds,
            message: 'Order placed successfully'
        });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Checkout error:', e);
        res.status(500).json({ error: e.message || 'Checkout failed' });
    } finally {
        client.release();
    }
});

// Legacy Create booking (Auth Required)
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { providerId, serviceId, userName, serviceName, providerName, price, details, items, bundleId, appointmentDate, appointmentType } = req.body;

        if (!providerId || !serviceName || !providerName) {
            return res.status(400).json({ error: 'الحقول المطلوبة غير مكتملة' });
        }

        const status = appointmentType === 'maintenance' ? 'pending_appointment' : 'pending';

        const result = await db.query(
            `INSERT INTO bookings 
             (user_id, provider_id, service_id, user_name, service_name, provider_name, price, details, items, status, bundle_id, appointment_date, appointment_type) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
             RETURNING id`,
            [userId, providerId, serviceId, req.user.name, serviceName, providerName, price, details, JSON.stringify(items || []), status, bundleId, appointmentDate || null, appointmentType || 'immediate']
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

// ... (GET /:id remains mostly checking columns, need to ensure bundle_id is returned if queried *)

// Get bookings by provider (Auth Required)
router.get('/provider/:providerId', verifyToken, isProviderOrAdmin, async (req, res) => {
    try {
        const { providerId } = req.params;

        // Security check: ensure the provider is viewing their own data
        if (req.user.user_type !== 'admin') {
            const providerCheck = await db.query('SELECT id FROM providers WHERE user_id = $1 AND id = $2', [req.user.id, providerId]);
            if (providerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على حجوزات هذا المتجر' });
            }
        }

        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, provider_id, status, details, items, price, halan_order_id, booking_date, bundle_id, parent_order_id, appointment_date, appointment_type
            FROM bookings
            WHERE provider_id = $1
            ORDER BY booking_date DESC
        `, [providerId]);

        const bookings = result.rows.map(b => ({
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name,
            providerName: b.provider_name,
            providerId: b.provider_id?.toString(),
            status: b.status,
            details: b.details,
            items: b.items,
            price: parseFloat(b.price || 0),
            halanOrderId: b.halan_order_id,
            date: b.booking_date,
            bundleId: b.bundle_id,
            parentOrderId: b.parent_order_id,
            appointmentDate: b.appointment_date,
            appointmentType: b.appointment_type
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get provider bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

// Get bookings by user (Auth Required)
router.get('/user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Security check: users can only see their own bookings
        if (req.user.user_type !== 'admin' && req.user.id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على هذه البيانات' });
        }

        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, provider_id, status, details, items, price, halan_order_id, booking_date, bundle_id, parent_order_id, appointment_date, appointment_type
            FROM bookings
            WHERE user_id = $1
            ORDER BY booking_date DESC
        `, [userId]);

        const bookings = result.rows.map(b => ({
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name,
            providerName: b.provider_name,
            providerId: b.provider_id?.toString(),
            status: b.status,
            details: b.details,
            items: b.items,
            price: parseFloat(b.price || 0),
            halanOrderId: b.halan_order_id,
            date: b.booking_date,
            bundleId: b.bundle_id,
            parentOrderId: b.parent_order_id,
            appointmentDate: b.appointment_date,
            appointmentType: b.appointment_type
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get user bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

// Update booking status (Auth Required)
router.patch('/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, price } = req.body;

        const validStatuses = ['pending', 'pending_appointment', 'confirmed', 'completed', 'cancelled', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة غير صالحة' });
        }

        // FETCH BOOKING INFO FOR SECURITY CHECKS AND SOCKETS
        const bookingResult = await db.query('SELECT user_id, provider_id, parent_order_id, halan_order_id FROM bookings WHERE id = $1', [id]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ error: 'الحجز غير موجود' });
        }
        const booking = bookingResult.rows[0];

        // Authorization Logic:
        // 1. Admin can do anything
        // 2. Customer can only cancel their own booking
        // 3. Provider can confirm/complete/reject their own booking
        if (req.user.user_type !== 'admin') {
            if (status === 'cancelled') {
                if (req.user.id !== booking.user_id) {
                    return res.status(403).json({ error: 'لا يمكنك إلغاء حجز لا يخصك' });
                }
            } else {
                // Confirm/Complete/Reject - Must be the provider owner
                const providerCheck = await db.query('SELECT id FROM providers WHERE user_id = $1 AND id = $2', [req.user.id, booking.provider_id]);
                if (providerCheck.rows.length === 0) {
                    return res.status(403).json({ error: 'غير مصرح لك بتغيير حالة هذا الطلب' });
                }
            }
        }

        let query = 'UPDATE bookings SET status = $1';
        let values = [status];

        if (price !== undefined) {
            query += ', price = $2';
            values.push(price);
        }

        query += ` WHERE id = $${values.length + 1}`;
        values.push(id);

        await db.query(query, values);

        const io = req.app.get('io');
        const { addNotificationJob } = require('../utils/queue');

        if (io) {
            io.emit('booking-updated', {
                id,
                status,
                parentId: booking.parent_order_id
            });
        }

        // Background Job for Customer Notification
        if (bookingInfo.rows.length > 0) {
            const userIdResult = await db.query('SELECT user_id FROM bookings WHERE id = $1', [id]);
            if (userIdResult.rows.length > 0) {
                const message = `تم تحديث حالة طلبك رقم ${id} إلى: ${status}`;
                await addNotificationJob(userIdResult.rows[0].user_id, message, 'order_update');
            }
        }

        // ==========================================
        // SYNC WITH DELIVERY ORDER (Auto-Assign if Confirmed)
        // ==========================================
        const { performAutoAssign } = require('../utils/driver-assignment');

        if (bookingInfo.rows.length > 0 && bookingInfo.rows[0].halan_order_id) {
            const halanOrderId = bookingInfo.rows[0].halan_order_id;
            const providerId = bookingInfo.rows[0].provider_id;

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
        // Recalculate parent order status if applicable
        if (bookingInfo.rows.length > 0 && bookingInfo.rows[0].parent_order_id) {
            await syncParentOrderStatus(bookingInfo.rows[0].parent_order_id, io);
        }

        res.json({ message: 'تم تحديث حالة الحجز بنجاح' });
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ error: 'حدث خطأ في تحديث الحجز' });
    }
});

// ==========================================
// RESCHEDULE APPOINTMENT (Negotiation Loop)
// Supports both provider and customer rescheduling
// ==========================================
router.patch('/:id/reschedule', async (req, res) => {
    try {
        const { id } = req.params;
        const { newDate, updatedBy } = req.body;
        // updatedBy: 'provider' or 'customer'

        if (!newDate) {
            return res.status(400).json({ error: 'يجب تحديد الموعد الجديد' });
        }

        const party = updatedBy === 'customer' ? 'customer' : 'provider';
        const newStatus = party === 'provider' ? 'provider_rescheduled' : 'customer_rescheduled';

        // Update the appointment date, status, and who made the change
        const result = await db.query(
            'UPDATE bookings SET appointment_date = $1, status = $2, last_updated_by = $3 WHERE id = $4 RETURNING *',
            [newDate, newStatus, party, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = result.rows[0];
        const io = req.app.get('io');

        const formattedDate = new Date(newDate).toLocaleString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        if (party === 'provider') {
            // Notify customer: provider suggested a new time
            if (booking.user_id) {
                await createNotification(
                    booking.user_id,
                    `اقترح مقدم الخدمة موعداً جديداً لطلبك #${String(id).substring(0, 8)}: ${formattedDate}. يمكنك قبوله أو اقتراح موعد آخر.`,
                    'appointment_negotiation',
                    String(id),
                    io
                );
            }
        } else {
            // Notify provider: customer counter-offered
            // Find provider's user_id
            if (booking.provider_id) {
                const providerRes = await db.query('SELECT user_id FROM providers WHERE id = $1', [booking.provider_id]);
                const providerUserId = providerRes.rows[0]?.user_id;
                if (providerUserId) {
                    await createNotification(
                        providerUserId,
                        `العميل عدّل موعد الطلب #${String(id).substring(0, 8)} إلى: ${formattedDate}. يمكنك قبوله أو اقتراح موعد آخر.`,
                        'appointment_negotiation',
                        String(id),
                        io
                    );
                }
            }
        }

        // Emit booking update event
        if (io) {
            io.emit('booking-updated', { id, status: newStatus, appointmentDate: newDate, lastUpdatedBy: party });
        }

        res.json({ success: true, message: 'تم تغيير الموعد بنجاح', booking });
    } catch (error) {
        console.error('Reschedule error:', error);
        res.status(500).json({ error: 'حدث خطأ في تغيير الموعد' });
    }
});

// ==========================================
// ACCEPT APPOINTMENT (Either party confirms)
// ==========================================
router.patch('/:id/accept-appointment', async (req, res) => {
    try {
        const { id } = req.params;
        const { acceptedBy } = req.body;
        // acceptedBy: 'provider' or 'customer'

        const result = await db.query(
            'UPDATE bookings SET status = $1, last_updated_by = $2 WHERE id = $3 RETURNING *',
            ['confirmed', acceptedBy || 'customer', id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = result.rows[0];
        const io = req.app.get('io');
        const shortId = String(id).substring(0, 8);

        // Notify BOTH parties
        // 1. Notify customer
        if (booking.user_id) {
            await createNotification(
                booking.user_id,
                `تم تأكيد موعد طلبك #${shortId}! يمكنك الآن التواصل مع مقدم الخدمة. 📞`,
                'appointment_confirmed',
                String(id),
                io
            );
        }

        // 2. Notify provider
        if (booking.provider_id) {
            const providerRes = await db.query('SELECT user_id FROM providers WHERE id = $1', [booking.provider_id]);
            const providerUserId = providerRes.rows[0]?.user_id;
            if (providerUserId) {
                await createNotification(
                    providerUserId,
                    `تم تأكيد موعد الطلب #${shortId}! يمكنك الآن التواصل مع العميل. 📞`,
                    'appointment_confirmed',
                    String(id),
                    io
                );
            }
        }

        // Emit booking update event
        if (io) {
            io.emit('booking-updated', { id, status: 'confirmed', lastUpdatedBy: acceptedBy });
        }

        res.json({ success: true, message: 'تم تأكيد الموعد بنجاح', booking });
    } catch (error) {
        console.error('Accept appointment error:', error);
        res.status(500).json({ error: 'حدث خطأ في تأكيد الموعد' });
    }
});

// Generic booking update (e.g., set halanOrderId)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No data provided' });
        }

        const allowedFields = ['halan_order_id', 'halanOrderId', 'status', 'items', 'details'];
        const setClauses = [];
        const values = [];
        let counter = 1;

        for (const [key, value] of Object.entries(updates)) {
            let field = key;
            if (key === 'halanOrderId') field = 'halan_order_id';

            if (allowedFields.includes(field)) {
                setClauses.push(`${field} = $${counter}`);
                values.push(field === 'items' ? JSON.stringify(value) : value);
                counter++;
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'Invalid fields' });
        }

        values.push(id);
        const query = `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${counter} RETURNING *`;

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Trigger parent order sync if this booking belongs to one
        if (result.rows[0].parent_order_id) {
            const io = req.app.get('io');
            await syncParentOrderStatus(result.rows[0].parent_order_id, io);
        }

        res.json({ success: true, booking: result.rows[0] });
    } catch (error) {
        console.error('Generic booking update error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all bookings (for admin or general usage)
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, user_name, service_name, provider_name, provider_id, status, details, items, price, halan_order_id, booking_date, parent_order_id, appointment_date, appointment_type
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
            price: parseFloat(b.price || 0),
            halanOrderId: b.halan_order_id,
            date: b.booking_date,
            parentOrderId: b.parent_order_id,
            appointmentDate: b.appointment_date,
            appointmentType: b.appointment_type
        }));

        res.json(bookings);
    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب الحجوزات' });
    }
});

// Get Single Booking by ID (with Provider Phone)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // SKIP if id is special keyword to be safe
        if (['provider', 'user', 'checkout', 'track'].includes(id)) return res.next();

        const result = await db.query(`
            SELECT 
                b.*,
                p.name as "providerName", 
                p.category as "providerCategory",
                u.phone as "providerPhone",
                s.name as "serviceName", s.price as "servicePrice", s.image as "serviceImage"
            FROM bookings b
            LEFT JOIN providers p ON b.provider_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const b = result.rows[0];
        const booking = {
            id: b.id.toString(),
            userName: b.user_name,
            serviceName: b.service_name || b.serviceName,
            providerName: b.provider_name || b.providerName,
            providerId: b.provider_id?.toString(),
            providerPhone: b.providerPhone,
            status: b.status,
            details: b.details,
            items: b.items,
            price: parseFloat(b.price || 0),
            halanOrderId: b.halan_order_id,
            date: b.booking_date,
            bundleId: b.bundle_id,
            parentOrderId: b.parent_order_id,
            appointmentDate: b.appointment_date,
            appointmentType: b.appointment_type,
            lastUpdatedBy: b.last_updated_by
        };

        res.json(booking);
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات الحجز' });
    }
});

module.exports = router;
