const deliveryService = require('../services/delivery.service');
const deliveryRepo = require('../repositories/delivery.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const db = require('../db');

function parseItems(rawItems) {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'string') {
        try {
            const parsed = JSON.parse(rawItems);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }
    return [];
}

function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

exports.getCustomerOrdersPublic = catchAsync(async (req, res) => {
    const { phone, userId } = req.body || {};
    const normalizedPhone = normalizeDigits(phone);

    if (!normalizedPhone && !userId) {
        throw new AppError('رقم الهاتف أو معرف المستخدم مطلوب', 400);
    }

    const conditions = [];
    const params = [];

    if (userId) {
        params.push(Number(userId));
        conditions.push(`b.user_id = $${params.length}`);
    }

    if (normalizedPhone) {
        params.push(normalizedPhone);
        const phoneIdx = params.length;
        conditions.push(`(
            regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g') = $${phoneIdx}
            OR regexp_replace(COALESCE(b.details, ''), '\\D', '', 'g') LIKE '%' || $${phoneIdx} || '%'
        )`);
    }

    const query = `
        SELECT
            b.id,
            b.parent_order_id,
            b.status,
            b.items,
            b.price,
            b.booking_date,
            b.created_at,
            b.details,
            b.provider_name,
            COALESCE(u.name, b.user_name, 'عميل') AS customer_name,
            u.phone AS customer_phone
        FROM bookings b
        LEFT JOIN users u ON u.id = b.user_id
        WHERE ${conditions.join(' OR ')}
        ORDER BY COALESCE(b.booking_date, b.created_at) DESC, b.id DESC
        LIMIT 100
    `;

    const result = await db.query(query, params);
    const rows = result.rows || [];

    const grouped = new Map();
    for (const row of rows) {
        const key = row.parent_order_id ? `P${row.parent_order_id}` : String(row.id);
        const items = parseItems(row.items);
        const existing = grouped.get(key);

        if (!existing) {
            grouped.set(key, {
                id: key,
                customer_name: row.customer_name || 'عميل',
                customer_phone: row.customer_phone || phone || '',
                delivery_address: row.details || 'غير متاح',
                status: row.status || 'pending',
                items,
                delivery_fee: 0,
                created_at: row.booking_date || row.created_at || new Date().toISOString(),
                total_price: Number(row.price || 0),
                is_parent: !!row.parent_order_id
            });
        } else {
            existing.items = [...existing.items, ...items];
            existing.total_price = Number(existing.total_price || 0) + Number(row.price || 0);
            if (existing.status !== 'delivered' && row.status) existing.status = row.status;
        }
    }

    res.status(200).json({ success: true, orders: Array.from(grouped.values()) });
});

exports.trackOrderPublic = catchAsync(async (req, res) => {
    const rawId = String(req.params.id || '');

    if (rawId.toUpperCase().startsWith('P')) {
        const parentId = Number(rawId.slice(1));
        if (!Number.isInteger(parentId) || parentId <= 0) {
            throw new AppError('معرف الطلب غير صالح', 400);
        }

        const result = await db.query(
            `SELECT b.id, b.parent_order_id, b.status, b.items, b.price, b.provider_name,
                    b.booking_date, b.created_at, b.details,
                    COALESCE(u.name, b.user_name, 'عميل') AS customer_name,
                    u.phone AS customer_phone
             FROM bookings b
             LEFT JOIN users u ON u.id = b.user_id
             WHERE b.parent_order_id = $1
             ORDER BY b.id ASC`,
            [parentId]
        );

        if (result.rows.length === 0) throw new AppError('الطلب غير موجود', 404);

        const first = result.rows[0];
        const subOrders = result.rows.map((r) => ({
            id: r.id,
            provider_name: r.provider_name,
            status: r.status,
            price: Number(r.price || 0),
            items: parseItems(r.items)
        }));

        const order = {
            id: `P${parentId}`,
            order_number: `P${parentId}`,
            customer_name: first.customer_name || 'عميل',
            customer_phone: first.customer_phone || '',
            delivery_address: first.details || 'غير متاح',
            pickup_address: '',
            status: first.status || 'pending',
            items: subOrders.flatMap((s) => s.items),
            delivery_fee: 0,
            notes: first.details || '',
            created_at: first.booking_date || first.created_at,
            total_price: subOrders.reduce((sum, s) => sum + Number(s.price || 0), 0),
            is_parent: true,
            sub_orders: subOrders
        };

        return res.status(200).json({ success: true, order });
    }

    const bookingId = Number(rawId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
        throw new AppError('معرف الطلب غير صالح', 400);
    }

    const result = await db.query(
        `SELECT b.id, b.parent_order_id, b.status, b.items, b.price, b.provider_name,
                b.booking_date, b.created_at, b.details,
                COALESCE(u.name, b.user_name, 'عميل') AS customer_name,
                u.phone AS customer_phone
         FROM bookings b
         LEFT JOIN users u ON u.id = b.user_id
         WHERE b.id = $1
         LIMIT 1`,
        [bookingId]
    );

    const booking = result.rows[0];
    if (!booking) throw new AppError('الطلب غير موجود', 404);

    const order = {
        id: booking.id,
        order_number: String(booking.id),
        customer_name: booking.customer_name || 'عميل',
        customer_phone: booking.customer_phone || '',
        delivery_address: booking.details || 'غير متاح',
        pickup_address: '',
        status: booking.status || 'pending',
        items: parseItems(booking.items),
        delivery_fee: 0,
        notes: booking.details || '',
        created_at: booking.booking_date || booking.created_at,
        total_price: Number(booking.price || 0),
        is_parent: false,
        provider_name: booking.provider_name
    };

    return res.status(200).json({ success: true, order });
});

exports.getOrders = catchAsync(async (req, res, next) => {
    const result = await deliveryService.getOrders(req.user, req.query);
    res.status(200).json({
        success: true,
        data: result.records,
        pagination: {
            total: result.total,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            totalPages: Math.ceil(result.total / (parseInt(req.query.limit) || 50))
        }
    });
});

exports.getCourierHistory = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = String(req.user.role || req.user.type || '').toLowerCase();

    if (!['courier', 'partner_courier', 'admin', 'owner', 'partner_owner'].includes(role)) {
        throw new AppError('غير مصرح لك بعرض سجل المندوب', 403);
    }

    const period = String(req.query.period || 'today').toLowerCase();
    const data = await deliveryService.getCourierHistory(userId, role, period, req.query.courierId);

    res.status(200).json({ success: true, data });
});

exports.getOrder = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;

    const order = await deliveryRepo.getOrderByIdSecure(req.params.id, { userId, role });
    if (!order) throw new AppError('الطلب غير موجود أو غير مصرح لك بمشاهدته', 404);

    // Filter sub-orders
    const subOrders = await deliveryRepo.getLinkedBookings(req.params.id);
    order.sub_orders = subOrders;

    res.status(200).json({ success: true, data: order });
});

exports.createOrder = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;

    const order = await deliveryService.createOrder(userId, role, req.body);
    res.status(201).json({ success: true, data: order });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { id } = req.params;
    const io = req.app.get('io');

    await deliveryService.updateStatus(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب بنجاح' });
});

exports.assignCourier = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { id } = req.params;
    const io = req.app.get('io');

    const order = await deliveryService.assignCourier(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تعيين المندوب بنجاح', data: order });
});

exports.updateOrderMeta = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { id } = req.params;
    const io = req.app.get('io');

    const order = await deliveryService.updateOrderMeta(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تحديث بيانات الطلب', data: order });
});

exports.softDelete = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await deliveryRepo.softDelete(id);
    res.status(200).json({ success: true, message: 'تم حذف الطلب بنجاح' });
});

exports.autoAssign = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { performAutoAssign } = require('../utils/driver-assignment');
    const io = req.app.get('io');

    const result = await performAutoAssign(id, userId, io);
    res.status(200).json({ success: true, message: `تم تعيين الطلب للمسؤول ${result ? result.name : ''}`, supervisor: result });
});

exports.updateOrder = catchAsync(async (req, res, next) => {
    const safeData = {};
    if (req.body.status !== undefined) safeData.status = String(req.body.status);
    if (req.body.courier_id !== undefined) safeData.courier_id = req.body.courier_id ? parseInt(req.body.courier_id) : null;
    if (req.body.supervisor_id !== undefined) safeData.supervisor_id = req.body.supervisor_id ? parseInt(req.body.supervisor_id) : null;
    if (req.body.source !== undefined) safeData.source = req.body.source;

    if (Object.keys(safeData).length === 0) {
        return next(new AppError('لا توجد بيانات صالحة للتحديث', 400));
    }

    const io = req.app.get('io');
    const updatedOrder = await deliveryService.updateOrder(
        req.params.id,
        req.user.id || req.user.userId,
        req.user.role || req.user.type,
        safeData,
        io
    );

    res.status(200).json({
        status: 'success',
        data: updatedOrder
    });
});
