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

// Get orders (filtered by role and status)
router.get('/', authenticatePartner, async (req, res) => {
    try {
        const { status, courierId } = req.query;
        const { role, userId } = req.user;

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
        const { userId } = req.user;

        // Get orders assigned to this courier, OR unassigned pending orders
        // Exclude deleted orders
        const result = await pool.query(`
            SELECT * FROM delivery_orders 
            WHERE (courier_id = $1 OR (courier_id IS NULL AND status = 'pending'))
            AND status IN ('pending', 'assigned', 'picked_up', 'in_transit')
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
        const { userId } = req.user;
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
        const { role, userId } = req.user;

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
        const { role } = req.user;

        // All partners can create orders (Owner, Supervisor, Courier)
        // If it's a courier, they are usually creating it for themselves.

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
            notes,
            deliveryFee,
            items, // New items array from Edit page
            products // Legacy items array from Create page
        } = req.body;

        // Generate order number
        const orderNumber = `HLN-${Date.now().toString(36).toUpperCase()}`;

        // Set supervisor_id based on role: 
        // Only supervisors get assigned as supervisors. 
        // Orders created by couriers or owners stay visible to owners (and couriers if assigned) 
        // but hidden from regular supervisors unless they created them.
        const effectiveSupervisorId = (role === 'supervisor') ? req.user.userId : null;

        // If it's a courier creating it, courierId should be their own ID if not specified
        const effectiveCourierId = (role === 'courier' && !courierId) ? req.user.userId : courierId;

        // If a courier creates the order, it starts as 'in_transit' (Starting delivery now)
        const initialStatus = (role === 'courier') ? 'in_transit' : 'pending';

        const result = await pool.query(`
            INSERT INTO delivery_orders 
            (order_number, customer_name, customer_phone, pickup_address, delivery_address,
             pickup_lat, pickup_lng, delivery_lat, delivery_lng, courier_id, supervisor_id, notes, delivery_fee, items, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            orderNumber, customerName, customerPhone, pickupAddress, deliveryAddress,
            pickupLat, pickupLng, deliveryLat, deliveryLng, effectiveCourierId, effectiveSupervisorId, notes, deliveryFee, JSON.stringify(items || products), initialStatus
        ]);

        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

// Update Order (Edit)
router.put('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.user;
        const fs = require('fs');
        const path = require('path');
        const logFile = path.join(__dirname, '..', 'debug_orders.log');

        const log = (msg) => {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
        };

        // Check permission (only owner/manager)
        if (role === 'courier') {
            return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل الطلبات' });
        }

        const {
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryFee,
            items,
            notes,
            courierId // Add this
        } = req.body;

        // Determine new status based on courier assignment
        const newStatus = courierId ? 'assigned' : 'pending';

        log(`Updating Order ${id}: courierId=${courierId}, newStatus=${newStatus}`);

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
        `, [customerName, customerPhone, deliveryAddress, deliveryFee, JSON.stringify(items), notes, courierId || null, newStatus, id]);

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


// Courier Pricing - Accept order with pricing modifications
router.patch('/:id/courier-pricing', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;
        const { role, userId } = req.user;
        const { items, deliveryFee } = req.body;

        // Only couriers can use this endpoint
        if (role !== 'courier') {
            return res.status(403).json({ success: false, error: 'هذا الإجراء متاح فقط للمناديب' });
        }

        // Get the original order to store modifications
        const originalOrder = await pool.query('SELECT * FROM delivery_orders WHERE id = $1', [id]);
        if (originalOrder.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const order = originalOrder.rows[0];

        // Check if courier is assigned or order is unassigned pending
        if (order.courier_id && order.courier_id !== userId) {
            return res.status(403).json({ success: false, error: 'هذا الطلب معين لمندوب آخر' });
        }

        // Store courier modifications
        const courierModifications = {
            original_items: order.items,
            original_delivery_fee: order.delivery_fee,
            modified_items: items,
            modified_delivery_fee: deliveryFee,
            modified_by: userId,
            modified_at: new Date().toISOString()
        };

        // Update order with courier pricing
        await pool.query(`
            UPDATE delivery_orders 
            SET items = $1,
                delivery_fee = $2,
                courier_id = $3,
                status = 'in_transit',
                courier_modifications = $4,
                is_modified_by_courier = true,
                courier_modified_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
        `, [JSON.stringify(items), deliveryFee, userId, JSON.stringify(courierModifications), id]);

        // Add to order history
        await pool.query(`
            INSERT INTO order_history (order_id, status, changed_by, notes)
            VALUES ($1, 'in_transit', $2, $3)
        `, [id, userId, 'تم استلام الطلب وتعديل الأسعار بواسطة المندوب']);

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('order-courier-modified', { orderId: id, courierId: userId });
            io.emit('order-status-changed', { orderId: id, status: 'in_transit' });
        }

        res.json({ success: true, message: 'تم استلام الطلب وحفظ الأسعار بنجاح' });

    } catch (error) {
        console.error('Courier pricing error:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر' });
    }
});

module.exports = router;
