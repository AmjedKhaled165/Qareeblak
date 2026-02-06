// Halan Orders Routes
// Delivery order management

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// Middleware to authenticate partner users
const authenticatePartner = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'التوكن غير صالح' });
    }
};

// ==================== SMART AUTO-ASSIGN LOGIC ====================
const { performAutoAssign } = require('../utils/driver-assignment');



// Finds the courier with the lowest workload and assigns the order to them
router.post('/:id/auto-assign', authenticatePartner, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const { id } = req.params;
        const result = await performAutoAssign(id, userId, req.app.get('io'));

        res.json({
            success: true,
            message: `تم تعيين الطلب للمندوب ${result.name}`,
            courier: result
        });

    } catch (error) {
        console.error('Auto-assign error:', error);
        res.status(500).json({ success: false, error: error.message || 'حدث خطأ في التعيين التلقائي' });
    }
});


// Get orders (filtered by role and status)
router.get('/', authenticatePartner, async (req, res) => {
    try {
        const { status, courierId } = req.query;
        const userId = req.user.userId || req.user.id;
        const role = req.user.role || req.user.type;

        let query = `
            SELECT o.*, 
                   c.name as courier_name,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
        `;
        const params = [];
        const conditions = [];

        // Role-based visibility
        if (role === 'courier') {
            params.push(userId);
            conditions.push(`o.courier_id = $${params.length}`);
        } else if (role === 'supervisor') {
            params.push(userId);
            conditions.push(`o.supervisor_id = $${params.length}`);
        }
        // Owners (role === 'owner') see all orders by default (no extra condition)

        // Handle specific status filters (including special 'deleted' and 'edited' lists)
        if (status === 'deleted') {
            conditions.push(`o.is_deleted = true`);
        } else if (status === 'edited') {
            conditions.push(`o.is_edited = true`);
            conditions.push(`o.is_deleted = false`); // Don't show deleted in edited list
        } else {
            // Default: Show active orders (not deleted)
            conditions.push(`o.is_deleted = false`);

            if (status && status !== 'all') {
                params.push(status);
                conditions.push(`o.status = $${params.length}`);
            }
        }

        if (courierId) {
            params.push(courierId);
            conditions.push(`o.courier_id = $${params.length}`);
        }

        if (req.query.supervisorId) {
            params.push(req.query.supervisorId);
            conditions.push(`o.supervisor_id = $${params.length}`);
        }

        if (req.query.search) {
            const searchTerm = req.query.search.trim();
            if (searchTerm) {
                params.push(`%${searchTerm}%`);
                const patternIdx = params.length;

                params.push(searchTerm);
                const rawIdx = params.length;

                conditions.push(`(
                    o.customer_name ILIKE $${patternIdx} OR 
                    o.customer_phone ILIKE $${patternIdx} OR 
                    o.delivery_address ILIKE $${patternIdx} OR 
                    o.notes ILIKE $${patternIdx} OR 
                    o.items::text ILIKE $${patternIdx} OR
                    o.id::text = $${rawIdx}
                )`);
            }
        }

        // Filter by order source (e.g., 'qareeblak', 'manual', 'whatsapp')
        if (req.query.source) {
            params.push(req.query.source);
            conditions.push(`o.source = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY o.created_at DESC';

        // console.log('DEBUG: Final Query:', query, params);


        const result = await pool.query(query, params);

        res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Get courier orders (for driver app)
router.get('/courier', authenticatePartner, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;

        // Get orders assigned to this courier, OR unassigned pending orders
        // Exclude deleted orders
        const result = await pool.query(`
            SELECT * FROM delivery_orders 
            WHERE (courier_id = $1 OR (courier_id IS NULL AND status IN ('pending', 'ready_for_pickup')))
            AND status IN ('pending', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered')
            AND is_deleted = false
            ORDER BY created_at DESC
        `, [userId]);

        res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('Get courier orders error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Get courier history (for stats)
router.get('/courier/history', authenticatePartner, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const { period } = req.query;

        console.log(`Getting history for user ${userId}, period: ${period}`);

        let dateCondition = "";
        const queryParams = [userId];

        if (period === 'today') {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            dateCondition = "AND created_at >= $2";
            queryParams.push(start);
        } else if (period === 'week') {
            // Start of week (Saturday)
            const start = new Date();
            const day = start.getDay(); // 0 (Sun) to 6 (Sat)
            const diff = (day + 1) % 7;
            start.setDate(start.getDate() - diff);
            start.setHours(0, 0, 0, 0);
            dateCondition = "AND created_at >= $2";
            queryParams.push(start);
        } else if (period === 'month') {
            const start = new Date();
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            dateCondition = "AND created_at >= $2";
            queryParams.push(start);
        }

        const query = `
            SELECT * FROM delivery_orders 
            WHERE courier_id = $1 
            ${dateCondition}
            AND is_deleted = false
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, queryParams);
        console.log(`History query result: ${result.rowCount} rows`);

        res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('Get courier history error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Get Single Order by ID
router.get('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.id;
        const role = req.user.role || req.user.type;

        const result = await pool.query(`
            SELECT o.*, 
                   c.name as courier_name,
                   c.phone as courier_phone,
                   s.name as supervisor_name
            FROM delivery_orders o
            LEFT JOIN users c ON o.courier_id = c.id
            LEFT JOIN users s ON o.supervisor_id = s.id
            WHERE o.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const order = result.rows[0];

        // Security check: Couriers can only see their own orders (or unassigned pending ones?)
        // Actually, couriers might need to see orders to accept them.
        // If status is 'pending' and no courier assigned, it's public to couriers?
        // Let's assume strict ownership for now, but allow viewing if it's open for taking.
        if (role === 'courier') {
            if (order.courier_id && order.courier_id !== userId) {
                return res.status(403).json({ success: false, error: 'غير مصرح لك بعرض هذا الطلب' });
            }
        }

        res.json({ success: true, data: order });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Create new order
router.post('/', authenticatePartner, async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const role = req.user.role || req.user.type;

        console.log(`[Halan POST] Creating order - UserID: ${userId}, Role: ${role}`);
        console.log(`[Halan POST] Body:`, JSON.stringify(req.body));

        const {
            customerName,
            customerPhone,
            pickupAddress,
            deliveryAddress,
            pickupLat,
            pickupLng,
            deliveryLat,
            deliveryLng,
            courierId,
            customerId,
            autoAssign, // Added this flag
            notes,
            deliveryFee,
            items, // New items array from Edit page
            products, // Legacy items array from Create page
            source = 'manual' // Default source
        } = req.body;

        const pLat = pickupLat || null;
        const pLng = pickupLng || null;
        const dLat = deliveryLat || null;
        const dLng = deliveryLng || null;
        const cId = courierId || null;
        const supId = null; // Will calculate
        const dFee = deliveryFee || 0;

        // Generate order number
        const orderNumber = `HLN-${Date.now().toString(36).toUpperCase()}`;

        // Set supervisor_id based on role: 
        // If owner creates it, pick the first supervisor found.
        // IF source is 'qareeblak', NO SUPERVISOR IS ASSIGNED (Managed by Owner/System)
        let effectiveSupervisorId = null;

        if (source !== 'qareeblak') {
            effectiveSupervisorId = (role === 'supervisor') ? req.user.userId : null;
            if (!effectiveSupervisorId) {
                const supResult = await pool.query("SELECT id FROM users WHERE user_type = 'partner_supervisor' LIMIT 1");
                if (supResult.rows.length > 0) {
                    effectiveSupervisorId = supResult.rows[0].id;
                }
            }
        }

        const effectiveCourierId = (role === 'courier' && !courierId) ? req.user.userId : courierId;
        const initialStatus = req.body.status || 'pending';

        // Determine final items array
        const finalItems = items || products || [];

        // Insert Order
        const result = await pool.query(`
            INSERT INTO delivery_orders 
            (order_number, customer_name, customer_phone, pickup_address, delivery_address, 
             pickup_lat, pickup_lng, delivery_lat, delivery_lng, 
             courier_id, supervisor_id, status, notes, delivery_fee, items, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            orderNumber, customerName, customerPhone, pickupAddress, deliveryAddress,
            pLat, pLng, dLat, dLng,
            effectiveCourierId || null, effectiveSupervisorId || null, initialStatus, notes, dFee, JSON.stringify(finalItems), source
        ]);

        let newOrder = result.rows[0];

        // FORCE Auto-Assignment if no courier is specified
        // Logic: Lowest workload, random tie-break (already in performAutoAssign)
        if (!effectiveCourierId) {
            console.log(`[Halan] 🚀 تعيين مندوب تلقائياً للطلب #${newOrder.id}...`);
            try {
                const assignedCourier = await performAutoAssign(newOrder.id, req.user.userId, req.app.get('io'));

                if (assignedCourier) {
                    console.log(`[Halan] ✅ تم التعيين للمندوب: ${assignedCourier.name} (حمل: ${assignedCourier.workload})`);
                    // Refresh data to get complete courier info
                    const refreshed = await pool.query(`
                        SELECT o.*, u.name as courier_name, u.phone as courier_phone
                        FROM delivery_orders o
                        LEFT JOIN users u ON o.courier_id = u.id
                        WHERE o.id = $1
                    `, [newOrder.id]);
                    newOrder = refreshed.rows[0];
                } else {
                    console.error(`[Halan] ❌ فشل التعيين التلقائي للطلب #${newOrder.id}`);
                }
            } catch (assignError) {
                console.error(`[Halan] ⚠️ خطأ في التعيين التلقائي للطلب #${newOrder.id}:`, assignError.message);
            }
        }

        res.status(201).json({ success: true, data: newOrder });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Update Order (Edit)
router.put('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.id;
        const role = req.user.role || req.user.type;
        const fs = require('fs');
        const path = require('path');
        const logFile = path.join(__dirname, '..', 'debug_orders.log');

        const log = (msg) => {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
        };

        const {
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryFee,
            items,
            notes,
            courierId, // Add this
            status // Add status field for courier status updates
        } = req.body;

        // If status is provided (used by courier to update status)
        if (status) {
            // Courier can only update their own orders
            if (role === 'courier' || role === 'partner_courier') {
                const orderResult = await pool.query('SELECT * FROM delivery_orders WHERE id = $1', [id]);
                if (orderResult.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
                }

                const order = orderResult.rows[0];

                // Allow if either: 
                // 1. Order is already assigned to this courier
                // 2. Order is unassigned (anyone can potentially take it/update it if it's broadcasted)
                if (order.courier_id && order.courier_id !== userId) {
                    return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل هذا الطلب' });
                }
            }

            // AUTO-ASSIGN CHECK: Trigger assignment for ANY status transition if courier is still missing.
            // This ensures "Every order must be assigned a courier" rule.
            const currentCourierCheck = await pool.query('SELECT courier_id FROM delivery_orders WHERE id = $1', [id]);
            if (currentCourierCheck.rows.length > 0 && !currentCourierCheck.rows[0].courier_id) {
                console.log(`[Halan] 🚀 Order #${id} (Status: ${status}) needs a courier. Triggering auto-assignment...`);
                try {
                    const io = req.app.get('io');
                    // Use performAutoAssign. It will set status to 'assigned' OR the target status provided.
                    // If target status is 'ready_for_pickup', we want to keep it.
                    await performAutoAssign(id, userId, io, status === 'pending' ? 'assigned' : status);

                    // If assigned successfully, we can return early as performAutoAssign handles update and history
                    return res.json({ success: true, message: 'تم تعيين المندوب وتحديث الحالة' });
                } catch (e) {
                    console.error('[Halan] ⚠️ Auto-assign failed during status update:', e.message);
                    // Fallthrough to manual update below to ensure status at least changes
                }
            }

            // Update order status
            await pool.query(
                'UPDATE delivery_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [status, id]
            );

            // SYNC TO BOOKINGS: Also update the parent booking status if it exists
            // This ensures customer tracking (bookings table) reflects driver actions
            try {
                // Map Halan statuses to Booking statuses
                // Halan: pending -> ready_for_pickup -> assigned -> picked_up -> delivered
                // Bookings: pending -> confirmed -> completed -> picked_up -> delivered

                let syncStatus = status;
                // If it's a known status that should reflect in the main booking progress
                const syncableStatuses = ['assigned', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled'];

                if (syncableStatuses.includes(status)) {
                    // Update the booking table
                    const syncResult = await pool.query(
                        'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE halan_order_id::text = $2::text RETURNING id',
                        [syncStatus, id]
                    );

                    if (syncResult.rows.length > 0) {
                        console.log(`[Halan Sync] Updated Booking ${syncResult.rows[0].id} status to ${syncStatus} (from Halan Order ${id})`);
                    }
                }
            } catch (syncErr) {
                console.error('[Halan] Failed to sync status to bookings:', syncErr);
            }

            // Add to history
            await pool.query(`
                INSERT INTO order_history (order_id, status, changed_by, notes)
                VALUES ($1, $2, $3, $4)
            `, [id, status, userId, `تم تحديث الحالة إلى: ${status}`]);

            // Emit socket event for real-time update
            const io = req.app.get('io');
            if (io) {
                io.emit('order-status-changed', { orderId: id, status });

                // Find associated booking to emit updates to customer
                try {
                    const bookingIds = await pool.query('SELECT id FROM bookings WHERE halan_order_id = $1', [id]);
                    if (bookingIds.rows.length > 0) {
                        const bId = bookingIds.rows[0].id;
                        io.emit('booking-updated', { id: bId, status }); // Emit with Booking ID
                        console.log(`[Halan] Emitted booking-updated for Booking #${bId} (Status: ${status})`);
                    }
                } catch (e) {
                    console.error('Socket emit lookup failed:', e);
                }
            }

            // 🚀 Send WhatsApp invoice when order is delivered
            if (status === 'delivered') {
                try {
                    const { sendOrderInvoice } = require('./whatsapp');
                    sendOrderInvoice(id).then(result => {
                        if (result.success) {
                            console.log(`📧 WhatsApp invoice sent for order #${id}`);
                        } else {
                            console.error(`❌ Failed to send WhatsApp invoice for order #${id}:`, result.error);
                        }
                    }).catch(err => {
                        console.error(`❌ WhatsApp invoice error for order #${id}:`, err.message);
                    });
                } catch (waError) {
                    console.error('WhatsApp module error:', waError.message);
                }
            }

            return res.json({ success: true, message: 'تم تحديث حالة الطلب بنجاح' });
        }

        // Otherwise, treat as order edit (only for owner/manager)
        if (role === 'courier' || role === 'partner_courier') {
            return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل الطلبات' });
        }

        // Determine new status based on courier assignment
        // Keep current status if it's already advanced, otherwise set based on courier presence
        const currentOrderResult = await pool.query('SELECT status, courier_id FROM delivery_orders WHERE id = $1', [id]);
        const currentOrder = currentOrderResult.rows[0];

        let targetStatus = currentOrder.status;
        if (courierId && !currentOrder.courier_id) {
            targetStatus = (targetStatus === 'pending') ? 'assigned' : targetStatus;
        }

        log(`Updating Order ${id}: courierId=${courierId}, targetStatus=${targetStatus}`);

        await pool.query(`
            UPDATE delivery_orders 
            SET customer_name = $1, 
                customer_phone = $2, 
                delivery_address = $3, 
                delivery_fee = $4, 
                items = $5, 
                notes = $6,
                courier_id = $7,
                status = $8,
                is_edited = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
        `, [customerName, customerPhone, deliveryAddress, deliveryFee, JSON.stringify(items), notes, courierId || null, targetStatus, id]);

        // If STILL NO COURIER after edit, trigger auto-assign!
        if (!courierId && !currentOrder.courier_id) {
            console.log(`[Halan Edit] Post-edit auto-assignment for Order #${id}...`);
            await performAutoAssign(id, userId, req.app.get('io'), targetStatus);
        }

        res.json({ success: true, message: 'تم تعديل الطلب بنجاح' });

    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Soft Delete Order
router.delete('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.user;

        // Check permission (only owner/manager)
        if (role === 'courier') {
            return res.status(403).json({ success: false, error: 'غير مصرح لك بحذف الطلبات' });
        }

        await pool.query(`
            UPDATE delivery_orders 
            SET is_deleted = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [id]);

        res.json({ success: true, message: 'تم حذف الطلب بنجاح' });

    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Update order status
router.patch('/:id/status', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, latitude, longitude } = req.body;

        // Update order
        await pool.query(
            'UPDATE delivery_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [status, id]
        );

        // Add to history
        await pool.query(`
            INSERT INTO order_history (order_id, status, changed_by, notes, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, status, req.user.userId, notes, latitude, longitude]);

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('order-status-changed', { orderId: id, status });
        }

        // 🚀 Send WhatsApp invoice when order is delivered
        if (status === 'delivered') {
            try {
                const { sendOrderInvoice } = require('./whatsapp');
                sendOrderInvoice(id).then(result => {
                    if (result.success) {
                        console.log(`📧 WhatsApp invoice sent for order #${id}`);
                    } else {
                        console.error(`❌ Failed to send WhatsApp invoice for order #${id}:`, result.error);
                    }
                }).catch(err => {
                    console.error(`❌ WhatsApp invoice error for order #${id}:`, err.message);
                });
            } catch (waError) {
                console.error('WhatsApp module error:', waError.message);
            }
        }

        res.json({ success: true, message: 'تم تحديث حالة الطلب' });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});


// Courier Pricing - Accept order with delivery fee and notes ONLY
// Couriers CANNOT modify product prices - read-only view of items
router.patch('/:id/courier-pricing', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { role, userId } = req.user;
        const { deliveryFee, notes } = req.body; // REMOVED: items - couriers cannot edit product prices

        // Only couriers can use this endpoint
        if (role !== 'courier') {
            return res.status(403).json({ success: false, error: 'هذا الإجراء متاح فقط للمناديب' });
        }

        // Get the original order
        const originalOrder = await pool.query('SELECT * FROM delivery_orders WHERE id = $1', [id]);
        if (originalOrder.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const order = originalOrder.rows[0];

        // Check if courier is assigned or order is unassigned/ready for pickup
        if (order.courier_id && order.courier_id !== userId) {
            return res.status(403).json({ success: false, error: 'هذا الطلب معين لمندوب آخر' });
        }

        // Store courier modifications (only delivery_fee and notes, NOT items)
        const courierModifications = {
            original_delivery_fee: order.delivery_fee,
            original_notes: order.notes,
            modified_delivery_fee: deliveryFee,
            modified_notes: notes,
            modified_by: userId,
            modified_at: new Date().toISOString()
        };

        // Update order with ONLY delivery_fee and notes - items remain unchanged
        await pool.query(`
            UPDATE delivery_orders 
            SET delivery_fee = $1,
                notes = COALESCE($2, notes),
                courier_id = $3,
                status = 'in_transit',
                courier_modifications = $4,
                is_modified_by_courier = true,
                courier_modified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
        `, [deliveryFee, notes, userId, JSON.stringify(courierModifications), id]);

        // Add to order history
        await pool.query(`
            INSERT INTO order_history (order_id, status, changed_by, notes)
            VALUES ($1, 'in_transit', $2, $3)
        `, [id, userId, `تم استلام الطلب بواسطة المندوب - رسوم التوصيل: ${deliveryFee} ج.م`]);

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('order-courier-modified', { orderId: id, courierId: userId });
            io.emit('order-status-changed', { orderId: id, status: 'in_transit' });
        }

        res.json({ success: true, message: 'تم استلام الطلب وحفظ رسوم التوصيل بنجاح' });

    } catch (error) {
        console.error('Courier pricing error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// ==================== CUSTOMER ORDER TRACKING ====================
// Public endpoint - no auth required (customer tracking)
router.post('/customer-orders', async (req, res) => {
    try {
        const { phone, userId } = req.body;

        if (!phone && !userId) {
            return res.status(400).json({ success: false, error: 'رقم الهاتف أو معرف المستخدم مطلوب' });
        }

        let allOrders = [];

        // 1. Get Delivery Orders (Search by userId or Phone)
        if (userId || phone) {
            const query = `
                SELECT 
                    o.id,
                    o.customer_name,
                    o.customer_phone,
                    o.delivery_address,
                    o.pickup_address,
                    o.status,
                    o.items,
                    o.delivery_fee,
                    o.notes,
                    o.created_at,
                    c.name as courier_name,
                    c.phone as courier_phone,
                    'delivery' as source_type
                FROM delivery_orders o
                LEFT JOIN users c ON o.courier_id = c.id
                WHERE 
                    (o.customer_id = $1 OR o.customer_phone = $2) 
                    AND o.is_deleted = false
                ORDER BY o.created_at DESC
            `;
            const deliveryResult = await pool.query(query, [userId || null, phone || 'INVALID_PHONE']);
            allOrders = [...deliveryResult.rows];
        }

        // 2. Get Bookings (Search by User ID OR Phone - avoid duplicates if already picked up as delivery)
        if (userId || phone) {
            try {
                // Get IDs of halan orders we already have
                const existingHalanIds = allOrders.map(o => o.id).filter(id => id && !isNaN(id));

                let query = `
                    SELECT 
                        b.id,
                        b.user_name as customer_name,
                        b.status,
                        b.status,
                        b.details,
                        b.price,
                        b.service_name,
                        b.items,
                        b.created_at,
                        b.halan_order_id,
                        'booking' as source_type
                    FROM bookings b
                    WHERE 1=1
                `;

                const params = [];
                let conditions = [];

                if (userId) {
                    params.push(userId);
                    conditions.push(`b.user_id = $${params.length}`);
                }

                if (phone) {
                    // Search for phone in details string (e.g. "الهاتف: 01xxxx")
                    // Use a more relaxed match for phone in text
                    params.push(phone);
                    conditions.push(`b.details LIKE '%' || $${params.length} || '%'`);
                }

                if (conditions.length > 0) {
                    query += ` AND (${conditions.join(' OR ')})`;
                } else {
                    query += ` AND 1=0`; // No search criteria
                }

                query += ` ORDER BY b.created_at DESC`;

                const bookingsResult = await pool.query(query, params);

                const mappedBookings = bookingsResult.rows
                    .filter(b => !b.halan_order_id || !existingHalanIds.includes(parseInt(b.halan_order_id)))
                    .map(b => {
                        // Try to extract phone
                        const phoneMatch = b.details ? b.details.match(/الهاتف:\s*(\d+)/) : null;
                        const customerPhone = phoneMatch ? phoneMatch[1] : phone || '';

                        // Map status
                        let status = 'pending';
                        if (b.status === 'confirmed') status = 'assigned';
                        if (b.status === 'completed') status = 'delivered';
                        if (b.status === 'cancelled') status = 'cancelled';
                        if (b.status === 'rejected') status = 'cancelled';


                        // Parse items if available in Booking
                        let items = null;
                        if (b.items) {
                            if (typeof b.items === 'string') {
                                try { items = JSON.parse(b.items); } catch (e) { items = []; }
                            } else if (Array.isArray(b.items)) {
                                items = b.items;
                            }
                        }

                        // Fallback to legacy single item ONLY if items is null
                        if (items === null) {
                            items = [{
                                name: b.service_name,
                                price: parseFloat(b.price) || 0,
                                quantity: 1
                            }];
                        }

                        return {
                            id: b.id,
                            customer_name: b.customer_name,
                            customer_phone: customerPhone,
                            delivery_address: b.details?.match(/العنوان:\s*([^|]+)/)?.[1]?.trim() || 'غير محدد',
                            pickup_address: 'المتجر',
                            status: status,
                            items: items,
                            delivery_fee: 0,
                            notes: b.details,
                            created_at: b.created_at,
                            source_type: 'booking'
                        };
                    });

                allOrders = [...allOrders, ...mappedBookings];
            } catch (err) {
                console.error("Error fetching bookings:", err);
            }
        }

        // Sort combined list
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Parse items for delivery orders
        const orders = allOrders.map(order => {
            if (typeof order.items === 'string') {
                try {
                    order.items = JSON.parse(order.items);
                } catch (e) {
                    order.items = [];
                }
            }
            return order;
        });

        res.json({ success: true, orders });

    } catch (error) {
        console.error('Customer orders error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في تحميل الطلبات' });
    }
});


router.get('/track/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let order = null;

        // 1. Try to find in BOOKINGS table first (Prioritize Booking ID)
        const bookingResult = await pool.query(`
            SELECT 
                b.id,
                b.user_name as customer_name,
                b.details as notes,
                b.status,
                b.price,
                b.items,
                b.service_name,
                b.created_at,
                b.provider_id,
                b.provider_name,
                d_o.id as halan_order_id,
                d_o.status as halan_status, 
                d_o.courier_id, 
                u.name as courier_name, 
                u.phone as courier_phone
            FROM bookings b
            LEFT JOIN delivery_orders d_o ON b.halan_order_id = d_o.id
            LEFT JOIN users u ON d_o.courier_id = u.id
            WHERE b.id::text = $1
        `, [id]);

        if (bookingResult.rows.length > 0) {
            const b = bookingResult.rows[0];

            console.log(`[Track Debug] ID=${id} -> BookingID=${b.id}, Status=${b.status}, HalanID=${b.halan_order_id}, HalanStatus=${b.halan_status}, Courier=${b.courier_name}`);

            // Smart Status Logic: Favor Halan order progress over Booking progress
            let effectiveStatus = b.status;
            const halan = b.halan_status;

            // If Halan order exists, check its status
            if (halan) {
                // Priority 1: Delivered
                if (halan === 'delivered') {
                    effectiveStatus = 'delivered';
                }
                // Priority 2: In Transit / Picked Up
                else if (halan === 'picked_up' || halan === 'in_transit') {
                    if (effectiveStatus !== 'delivered' && effectiveStatus !== 'cancelled') {
                        effectiveStatus = 'picked_up';
                    }
                }
                // Priority 3: Ready for pickup (Phase 3)
                else if (halan === 'ready_for_pickup' || halan === 'completed') {
                    if (!['picked_up', 'in_transit', 'delivered', 'cancelled'].includes(effectiveStatus)) {
                        effectiveStatus = 'ready_for_pickup';
                    }
                }
                // Priority 4: Assigned (Phase 2)
                else if (halan === 'assigned') {
                    if (effectiveStatus === 'pending' || effectiveStatus === 'confirmed') {
                        effectiveStatus = 'assigned';
                    }
                }
            }

            if (effectiveStatus !== b.status) {
                console.log(`[Track SmartStatus] ID=${id}: Overriding ${b.status} -> ${effectiveStatus} (Halan: ${halan})`);
            }

            // Parse items
            let items = null;
            if (b.items) {
                if (typeof b.items === 'string') {
                    try { items = JSON.parse(b.items); } catch (e) { items = []; }
                } else if (Array.isArray(b.items)) {
                    items = b.items;
                }
            }
            if (!items) {
                items = [{
                    name: b.service_name || 'خدمة',
                    price: parseFloat(b.price) || 0,
                    quantity: 1,
                    notes: b.notes
                }];
            }

            order = {
                id: b.id,
                customer_name: b.customer_name,
                customer_phone: b.notes ? (b.notes.match(/الهاتف:\s*([^|]+)/)?.[1]?.trim() || '') : '',
                delivery_address: b.notes ? (b.notes.match(/العنوان:\s*([^|]+)/)?.[1]?.trim() || 'غير محدد') : '',
                pickup_address: b.provider_name || 'غير محدد',
                status: effectiveStatus,
                items: items,
                delivery_fee: 0,
                notes: b.notes,
                created_at: b.created_at,
                courier_name: b.courier_name || null,
                courier_phone: b.courier_phone || null,
                provider_name: b.provider_name,
                provider_id: b.provider_id ? String(b.provider_id) : null,
                is_booking: true // Flag to indicate source
            };
        }

        // 2. If not found in Bookings, try Delivery Orders table (Direct Halan ID)
        if (!order && !isNaN(id)) {
            const result = await pool.query(`
                SELECT 
                    o.id,
                    o.customer_name,
                    o.customer_phone,
                    o.delivery_address,
                    o.pickup_address,
                    o.status,
                    o.items,
                    o.delivery_fee,
                    o.notes,
                    o.created_at,
                    c.name as courier_name,
                    c.phone as courier_phone,
                    s.id as provider_id,
                    s.name as provider_name
                FROM delivery_orders o
                LEFT JOIN users c ON o.courier_id = c.id
                LEFT JOIN users s ON o.supervisor_id = s.id
                WHERE o.id = $1 AND o.is_deleted = false
            `, [id]);

            if (result.rows.length > 0) {
                order = result.rows[0];
                if (typeof order.items === 'string') {
                    try { order.items = JSON.parse(order.items); } catch (e) { order.items = []; }
                }
            }
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'الطلب غير موجود'
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {
        console.error('Track order error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في تحميل بيانات الطلب' });
    }
});

// Customer cancel order (within 5 minutes only)
router.post('/:id/customer-cancel', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Try Delivery Orders
        let table = 'delivery_orders';
        let isBooking = false;

        let orderResult = await pool.query(`
            SELECT id, status, created_at FROM delivery_orders 
            WHERE id = $1 AND is_deleted = false
        `, [id]);

        // 2. If not found, Try Bookings
        if (orderResult.rows.length === 0) {
            orderResult = await pool.query(`
                SELECT id, status, created_at FROM bookings 
                WHERE id = $1
            `, [id]);

            if (orderResult.rows.length > 0) {
                table = 'bookings';
                isBooking = true;
            }
        }

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const order = orderResult.rows[0];

        // Check if order is already delivered or cancelled
        // Handle booking statuses (completed, rejected)
        if (order.status === 'delivered' || order.status === 'completed') {
            return res.status(400).json({ success: false, error: 'لا يمكن إلغاء طلب تم توصيله' });
        }
        if (order.status === 'cancelled' || order.status === 'rejected') {
            return res.status(400).json({ success: false, error: 'الطلب ملغي بالفعل' });
        }

        // Check if within 5 minutes (300 seconds)
        const createdAt = new Date(order.created_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - createdAt) / 1000);

        if (elapsedSeconds > 300) {
            return res.status(400).json({
                success: false,
                error: 'انتهت مهلة الإلغاء (5 دقائق). يرجى التواصل مع خدمة العملاء.'
            });
        }

        if (isBooking) {
            // Cancel Booking
            await pool.query(`
                UPDATE bookings 
                SET status = 'cancelled', 
                    details = COALESCE(details, '') || ' | تم الإلغاء بواسطة العميل',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [id]);

            // Should we sync linked halan order? Usually bookings are standalone or create halan order.
            // If linked to halan_order_id, maybe cancel that too? 
            // The user's code updates bookings when halan order is cancelled. 
            // We'll stick to just cancelling the entity we found.

        } else {
            // Cancel Delivery Order
            await pool.query(`
                UPDATE delivery_orders 
                SET status = 'cancelled', 
                    notes = COALESCE(notes, '') || ' | تم الإلغاء بواسطة العميل',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [id]);

            // UPDATE linked booking if exists
            await pool.query(`
                UPDATE bookings SET status = 'cancelled' 
                WHERE halan_order_id = $1
            `, [id]);

            // Add to order history
            await pool.query(`
                INSERT INTO order_history (order_id, status, changed_by, notes)
                VALUES ($1, 'cancelled', NULL, 'تم إلغاء الطلب بواسطة العميل')
            `, [id]);
        }

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('order-cancelled', { orderId: id });
            io.emit('order-status-changed', { orderId: id, status: 'cancelled' });
            if (isBooking) io.emit('booking-updated', { bookingId: id, status: 'cancelled' });
            else io.emit('booking-updated', { halanOrderId: id, status: 'cancelled' });
        }

        res.json({ success: true, message: 'تم إلغاء الطلب بنجاح' });

    } catch (error) {
        console.error('Customer cancel error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في إلغاء الطلب' });
    }
});

// Customer add item to order (available until delivery)
router.post('/:id/customer-add-item', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, quantity, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المنتج' });
        }

        // 1. Try Delivery Orders
        let table = 'delivery_orders';
        let isBooking = false;

        let orderResult = await pool.query(`
            SELECT id, status, items, created_at FROM delivery_orders 
            WHERE id = $1 AND is_deleted = false
        `, [id]);

        // 2. If not found, Try Bookings
        if (orderResult.rows.length === 0) {
            orderResult = await pool.query(`
                SELECT id, status, items, details, service_name, price, created_at FROM bookings 
                WHERE id = $1
            `, [id]);

            if (orderResult.rows.length > 0) {
                table = 'bookings';
                isBooking = true;
            }
        }

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const order = orderResult.rows[0];

        // Check if order is in transit, delivered or cancelled
        // For Bookings, status might be 'confirmed' instead of 'assigned'
        const blockedStatuses = ['picked_up', 'in_transit', 'delivered', 'cancelled', 'completed', 'rejected'];
        if (blockedStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                error: 'لا يمكن الإضافة في هذه المرحلة من الطلب'
            });
        }

        // Parse existing items
        let items = null;
        if (order.items) {
            if (typeof order.items === 'string') {
                try { items = JSON.parse(order.items); } catch (e) { items = null; }
            } else if (Array.isArray(order.items)) {
                items = order.items;
            }
        }

        // If booking and items is null (first time adding), materialize the original service
        if (isBooking && items === null) {
            items = [{
                name: order.service_name || 'خدمة',
                price: parseFloat(order.price) || 0,
                quantity: 1,
                notes: order.details || '' // using details as notes for the main service
            }];
        }

        // Ensure array
        if (!Array.isArray(items)) {
            items = [];
        }

        // Add new item
        items.push({
            name: name.trim(),
            price: parseFloat(price) || 0,
            quantity: parseInt(quantity) || 1,
            notes: notes || '',
            added_by_customer: true,
            added_at: new Date().toISOString()
        });

        // Update DB
        if (isBooking) {
            // Update Booking
            await pool.query(`
                UPDATE bookings
                SET items = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [JSON.stringify(items), id]);

            // SYNC: Also update linked delivery order if it exists
            const bookingCheck = await pool.query('SELECT halan_order_id FROM bookings WHERE id = $1', [id]);
            if (bookingCheck.rows.length > 0 && bookingCheck.rows[0].halan_order_id) {
                const hId = bookingCheck.rows[0].halan_order_id;
                await pool.query('UPDATE delivery_orders SET items = $1, is_edited = true WHERE id = $2', [JSON.stringify(items), hId]);
                console.log(`[addItem Sync] Synced items to Halan Order #${hId}`);

                // Emit to Halan dash
                const io = req.app.get('io');
                if (io) io.emit('order-updated', { orderId: hId });
            }
        } else {
            // Update Delivery Order
            await pool.query(`
                UPDATE delivery_orders 
                SET items = $1,
                    is_edited = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [JSON.stringify(items), id]);

            // SYNC: Also update linked booking if it exists
            const halanCheck = await pool.query('SELECT id FROM bookings WHERE halan_order_id = $1', [id]);
            if (halanCheck.rows.length > 0) {
                const bId = halanCheck.rows[0].id;
                await pool.query('UPDATE bookings SET items = $1 WHERE id = $2', [JSON.stringify(items), bId]);
                console.log(`[addItem Sync] Synced items to Booking #${bId}`);

                // Emit to Qareeblak dash
                const io = req.app.get('io');
                if (io) io.emit('booking-updated', { bookingId: bId });
            }

            // History
            await pool.query(`
                INSERT INTO order_history (order_id, status, changed_by, notes)
                VALUES ($1, $2, NULL, $3)
            `, [id, order.status, `أضاف العميل منتج: ${name.trim()}${notes ? ` - ملحوظة: ${notes}` : ''}`]);
        }

        // Emit socket events
        const io = req.app.get('io');
        if (io) {
            io.emit('order-item-added', { orderId: id, item: { name, price, quantity } });
            io.emit('order-updated', { orderId: id });
            if (isBooking) io.emit('booking-updated', { id: id }); // Standard Qareeblak event
            else io.emit('booking-updated', { halanOrderId: id }); // Custom event
        }

        res.json({
            success: true,
            message: 'تمت إضافة المنتج بنجاح',
            items
        });

    } catch (error) {
        console.error('Customer add item error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في إضافة المنتج' });
    }
});

// Customer remove item from order (available within 5 minutes only)
router.post('/:id/customer-remove-item', async (req, res) => {
    try {
        const { id } = req.params;
        const { itemIndex } = req.body;

        if (itemIndex === undefined || itemIndex === null) {
            return res.status(400).json({ success: false, error: 'يرجى تحديد المنتج للحذف' });
        }

        // 1. Try Delivery Orders
        let table = 'delivery_orders';
        let isBooking = false;

        let orderResult = await pool.query(`
            SELECT id, status, items, created_at FROM delivery_orders 
            WHERE id = $1 AND is_deleted = false
        `, [id]);

        // 2. If not found, Try Bookings
        if (orderResult.rows.length === 0) {
            orderResult = await pool.query(`
                SELECT id, status, items, details, service_name, price, created_at FROM bookings 
                WHERE id = $1
            `, [id]);

            if (orderResult.rows.length > 0) {
                table = 'bookings';
                isBooking = true;
            }
        }

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const order = orderResult.rows[0];

        // Check 5 minutes window
        const createdAt = new Date(order.created_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - createdAt) / 1000);

        // Extended time for bookings? Keep same rule for now
        if (elapsedSeconds > 300) {
            return res.status(400).json({
                success: false,
                error: 'انتهت مهلة التعديل (5 دقائق). يرجى التواصل مع خدمة العملاء.'
            });
        }

        const blockedStatuses = ['picked_up', 'in_transit', 'delivered', 'cancelled', 'completed', 'rejected'];
        if (blockedStatuses.includes(order.status)) {
            return res.status(400).json({ success: false, error: 'لا يمكن تعديل الطلب في هذه المرحلة' });
        }

        // Parse items
        let items = null;
        if (order.items) {
            if (typeof order.items === 'string') {
                try { items = JSON.parse(order.items); } catch (e) { items = null; }
            } else if (Array.isArray(order.items)) {
                items = order.items;
            }
        }

        // If booking and items is null (legacy booking), materialize the original service so it can be deleted
        if (isBooking && items === null) {
            items = [{
                name: order.service_name || 'خدمة',
                price: parseFloat(order.price) || 0,
                quantity: 1,
                notes: order.details || ''
            }];
        }

        if (!Array.isArray(items)) items = [];

        // Remove item
        if (itemIndex < 0 || itemIndex >= items.length) {
            return res.status(400).json({ success: false, error: 'المنتج غير موجود' });
        }

        const removedItem = items[itemIndex];
        items.splice(itemIndex, 1);

        // Update DB
        if (isBooking) {
            await pool.query(`
                UPDATE bookings 
                SET items = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [JSON.stringify(items), id]);

            // SYNC: Update linked delivery order
            const bookingCheck = await pool.query('SELECT halan_order_id FROM bookings WHERE id = $1', [id]);
            if (bookingCheck.rows.length > 0 && bookingCheck.rows[0].halan_order_id) {
                const hId = bookingCheck.rows[0].halan_order_id;
                await pool.query('UPDATE delivery_orders SET items = $1, is_edited = true WHERE id = $2', [JSON.stringify(items), hId]);

                // Emit to Halan dash
                const io = req.app.get('io');
                if (io) io.emit('order-updated', { orderId: hId });
            }
        } else {
            await pool.query(`
                UPDATE delivery_orders 
                SET items = $1,
                    is_edited = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [JSON.stringify(items), id]);

            // SYNC: Update linked booking
            const halanCheck = await pool.query('SELECT id FROM bookings WHERE halan_order_id = $1', [id]);
            if (halanCheck.rows.length > 0) {
                const bId = halanCheck.rows[0].id;
                await pool.query('UPDATE bookings SET items = $1 WHERE id = $2', [JSON.stringify(items), bId]);

                // Emit to Qareeblak dash
                const io = req.app.get('io');
                if (io) io.emit('booking-updated', { bookingId: bId });
            }

            // History
            await pool.query(`
                INSERT INTO order_history (order_id, status, changed_by, notes)
                VALUES ($1, $2, NULL, $3)
            `, [id, order.status, `حذف العميل منتج: ${removedItem.name}`]);
        }

        // Socket
        const io = req.app.get('io');
        if (io) {
            io.emit('order-updated', { orderId: id });
            if (isBooking) io.emit('booking-updated', { id: id });
            else io.emit('booking-updated', { halanOrderId: id });
        }

        res.json({ success: true, message: 'تم حذف المنتج بنجاح', items });

    } catch (error) {
        console.error('Customer remove item error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في حذف المنتج' });
    }
});

module.exports = router;
