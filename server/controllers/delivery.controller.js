const deliveryService = require('../services/delivery.service');
const deliveryRepo = require('../repositories/delivery.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const db = require('../db');
const { obfuscateOrder, encodeEntityId, decodeEntityId } = require('../utils/obfuscate');

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

function normalizeTrackingStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    const map = {
        'تم استلام الطلب': 'pending',
        'pending': 'pending',
        'new': 'pending',

        'جاري التحضير': 'assigned',
        'confirmed': 'assigned',
        'accepted': 'assigned',
        'assigned': 'assigned',
        'processing': 'assigned',

        'تم التحضير': 'ready_for_pickup',
        'جاهز للاستلام': 'ready_for_pickup',
        'ready': 'ready_for_pickup',
        'ready_for_pickup': 'ready_for_pickup',
        'completed': 'ready_for_pickup',

        'تم الاستلام من المطعم': 'in_transit',
        'جاري التوصيل': 'in_transit',
        'picked_up': 'in_transit',
        'in_transit': 'in_transit',

        'تم التوصيل': 'delivered',
        'delivered': 'delivered',

        'ملغي': 'cancelled',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
        'rejected': 'cancelled'
    };

    return map[raw] || raw || 'pending';
}

function getAggregateTrackingStatus(statuses) {
    const normalized = (Array.isArray(statuses) ? statuses : [])
        .map((s) => normalizeTrackingStatus(s))
        .filter(Boolean);

    if (normalized.length === 0) return 'pending';
    if (normalized.every((s) => s === 'cancelled')) return 'cancelled';

    const weight = {
        pending: 1,
        assigned: 2,
        ready_for_pickup: 3,
        in_transit: 4,
        delivered: 5,
        cancelled: 0
    };

    const activeStatuses = normalized.filter(s => s !== 'cancelled');
    if (activeStatuses.length === 0) return 'cancelled';

    const allHaveStatusOrHigher = (level) => {
        return activeStatuses.every(s => (weight[s] || 0) >= level);
    };
    const anyHaveStatusOrHigher = (level) => {
        return activeStatuses.some(s => (weight[s] || 0) >= level);
    };

    if (allHaveStatusOrHigher(weight.delivered)) return 'delivered';
    if (allHaveStatusOrHigher(weight.in_transit)) return 'in_transit';
    if (allHaveStatusOrHigher(weight.ready_for_pickup)) return 'ready_for_pickup';
    if (anyHaveStatusOrHigher(weight.assigned)) return 'assigned';
    
    return 'pending';
}

exports.getCustomerOrdersPublic = catchAsync(async (req, res) => {
    const { phone, userId: rawUserId } = req.body || {};
    const normalizedPhone = normalizeDigits(phone);

    const { decodeEntityId } = require('../utils/obfuscate');
    const userId = rawUserId ? (decodeEntityId('user', rawUserId) || rawUserId) : null;

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
                statuses: [row.status || 'pending'],
                items,
                delivery_fee: 0,
                created_at: row.booking_date || row.created_at || new Date().toISOString(),
                total_price: Number(row.price || 0),
                is_parent: !!row.parent_order_id
            });
        } else {
            existing.items = [...existing.items, ...items];
            existing.total_price = Number(existing.total_price || 0) + Number(row.price || 0);
            if (row.status) existing.statuses.push(row.status);
        }
    }
    const { encodeEntityId } = require('../utils/obfuscate');
    const ordersWithEncryptedId = Array.from(grouped.values()).map(order => {
        const { statuses, ...orderWithoutStatuses } = order;
        orderWithoutStatuses.status = getAggregateTrackingStatus(statuses);

        let encryptedId;
        if (order.is_parent) {
            const numericId = String(order.id).startsWith('P') ? String(order.id).slice(1) : String(order.id);
            encryptedId = encodeEntityId('parent_order', numericId);
        } else {
            encryptedId = encodeEntityId('booking', order.id);
        }
        return {
            ...orderWithoutStatuses,
            id: encryptedId,
            order_number: String(order.id)
        };
    });

    res.status(200).json({ success: true, orders: ordersWithEncryptedId });
});

exports.trackOrderPublic = catchAsync(async (req, res) => {
    const rawId = String(req.params.id || '');

    // Try to decode as encrypted ID first
    let decodedParentId = decodeEntityId('parent_order', rawId);
    let decodedBookingId = decodeEntityId('booking', rawId);
    const decodedOrderId = decodeEntityId('order', rawId);

    if (decodedOrderId !== null && decodedParentId === null && decodedBookingId === null) {
        const bResult = await db.query(
            `SELECT b.id, b.parent_order_id FROM bookings b WHERE b.halan_order_id::TEXT = $1 LIMIT 1`,
            [String(decodedOrderId)]
        );
        if (bResult.rows.length > 0) {
            const booking = bResult.rows[0];
            if (booking.parent_order_id) {
                decodedParentId = booking.parent_order_id;
            } else {
                decodedBookingId = booking.id;
            }
        }
    }

    // Legacy: support P{id} prefix for backward compatibility
    if (decodedParentId === null && rawId.toUpperCase().startsWith('P')) {
        const legacyParentId = Number(rawId.slice(1));
        if (!Number.isInteger(legacyParentId) || legacyParentId <= 0) {
            throw new AppError('معرف الطلب غير صالح', 400);
        }
        decodedParentId = legacyParentId;
    }

    if (decodedParentId !== null) {
        const parentId = decodedParentId;
        if (!Number.isInteger(parentId) || parentId <= 0) {
            throw new AppError('معرف الطلب غير صالح', 400);
        }

        const result = await db.query(
            `SELECT b.id, b.parent_order_id, b.status,
                    CASE 
                        WHEN d.status IN ('pending', 'assigned') THEN COALESCE(b.status, d.status)
                        ELSE COALESCE(d.status, b.status)
                    END AS effective_status,
                    p.status AS parent_status,
                    b.items, b.price, b.provider_name,
                    b.booking_date, b.created_at, b.details,
                    b.halan_order_id,
                    d.courier_id,
                    d.delivery_address,
                    d.notes,
                    d.delivery_fee,
                    c.name AS courier_name,
                    c.phone AS courier_phone,
                    COALESCE(u.name, b.user_name, 'عميل') AS customer_name,
                    u.phone AS customer_phone
             FROM bookings b
             LEFT JOIN users u ON u.id = b.user_id
             LEFT JOIN delivery_orders d ON CAST(b.halan_order_id AS TEXT) = CAST(d.id AS TEXT)
             LEFT JOIN parent_orders p ON p.id = b.parent_order_id
             LEFT JOIN users c ON c.id = d.courier_id
             WHERE b.parent_order_id = $1
             ORDER BY b.id ASC`,
            [parentId]
        );

        if (result.rows.length === 0) throw new AppError('الطلب غير موجود', 404);

        const first = result.rows[0];
        const subOrders = result.rows.map((r) => ({
            id: r.id,
            provider_name: r.provider_name,
            status: r.effective_status || r.status,
            price: Number(r.price || 0),
            items: parseItems(r.items),
            courier_name: r.courier_name || undefined,
            courier_phone: r.courier_phone || undefined
        }));

        const aggregateStatus = getAggregateTrackingStatus(subOrders.map((s) => s.status));
        const parentStatus = normalizeTrackingStatus(first.parent_status || first.status || 'pending');
        const effectiveParentStatus = parentStatus === 'cancelled' ? 'cancelled' : aggregateStatus;

        const order = {
            id: encodeEntityId('parent_order', parentId),
            order_number: String(parentId),
            customer_name: first.customer_name || 'عميل',
            customer_phone: first.customer_phone || '',
            delivery_address: first.delivery_address || first.details || 'غير متاح',
            pickup_address: '',
            status: effectiveParentStatus,
            items: subOrders.flatMap((s) => s.items),
            delivery_fee: Number(first.delivery_fee || 0),
            notes: first.notes || '',
            created_at: first.booking_date || first.created_at,
            total_price: subOrders.reduce((sum, s) => sum + Number(s.price || 0), 0),
            is_parent: true,
            courier_name: first.courier_name || undefined,
            courier_phone: first.courier_phone || undefined,
            sub_orders: subOrders.map(s => obfuscateOrder(s))
        };

        const encryptedId = encodeEntityId('parent_order', parentId);
        const encryptedResponse = {
            ...obfuscateOrder(order),
            id: encryptedId,
            order_number: encryptedId,
        };

        return res.status(200).json({ success: true, order: encryptedResponse });
    }

    const bookingId = decodedBookingId !== null ? decodedBookingId : Number(rawId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
        throw new AppError('معرف الطلب غير صالح', 400);
    }

    const result = await db.query(
        `SELECT b.id, b.parent_order_id, b.status,
            CASE 
                WHEN d.status IN ('pending', 'assigned') THEN COALESCE(b.status, d.status)
                ELSE COALESCE(d.status, b.status)
            END AS effective_status,
            b.items, b.price, b.provider_name,
            b.booking_date, b.created_at, b.details,
            b.halan_order_id,
            d.courier_id,
            d.delivery_address,
            d.notes,
            d.delivery_fee,
            c.name AS courier_name,
            c.phone AS courier_phone,
            COALESCE(u.name, b.user_name, 'عميل') AS customer_name,
            u.phone AS customer_phone
         FROM bookings b
         LEFT JOIN users u ON u.id = b.user_id
         LEFT JOIN delivery_orders d ON CAST(b.halan_order_id AS TEXT) = CAST(d.id AS TEXT)
         LEFT JOIN users c ON c.id = d.courier_id
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
        delivery_address: booking.delivery_address || booking.details || 'غير متاح',
        pickup_address: '',
        status: normalizeTrackingStatus(booking.effective_status || booking.status || 'pending'),
        items: parseItems(booking.items),
        delivery_fee: Number(booking.delivery_fee || 0),
        notes: booking.notes || '',
        created_at: booking.booking_date || booking.created_at,
        total_price: Number(booking.price || 0),
        is_parent: false,
        provider_name: booking.provider_name,
        courier_name: booking.courier_name || undefined,
        courier_phone: booking.courier_phone || undefined
    };

    return res.status(200).json({ success: true, order: obfuscateOrder(order) });
});

exports.trackOrderByCode = catchAsync(async (req, res) => {
    const { code } = req.params;
    if (!code || code.length !== 7) {
        throw new AppError('كود التتبع غير صالح', 400);
    }

    // Look up delivery_orders by tracking_code (case-insensitive)
    const dResult = await db.query(
        `SELECT id FROM delivery_orders WHERE LOWER(tracking_code) = LOWER($1) LIMIT 1`,
        [code]
    );
    if (dResult.rows.length === 0) {
        throw new AppError('الطلب غير موجود', 404);
    }
    const deliveryId = dResult.rows[0].id;

    // Find the associated booking by halan_order_id (cast to text to match VARCHAR)
    const bResult = await db.query(
        `SELECT b.id, b.parent_order_id FROM bookings b WHERE b.halan_order_id::TEXT = $1 LIMIT 1`,
        [String(deliveryId)]
    );

    if (bResult.rows.length > 0) {
        const booking = bResult.rows[0];
        // Pass the correct identifier to trackOrderPublic using encrypted ID
        if (booking.parent_order_id) {
            req.params.id = encodeEntityId('parent_order', booking.parent_order_id);
        } else {
            req.params.id = String(booking.id);
        }
    } else {
        req.params.id = String(deliveryId);
    }

    return exports.trackOrderPublic(req, res);
});

async function resolveDeliveryOrderId(rawId) {
    const { decodeEntityId } = require('../utils/obfuscate');
    
    const orderId = decodeEntityId('order', rawId);
    if (orderId !== null) return orderId;

    const parentId = decodeEntityId('parent_order', rawId);
    if (parentId !== null) {
        const res = await db.query(`SELECT halan_order_id FROM bookings WHERE parent_order_id = $1 LIMIT 1`, [parentId]);
        if (res.rows.length > 0) return res.rows[0].halan_order_id;
    }

    const bookingId = decodeEntityId('booking', rawId);
    if (bookingId !== null) {
        const res = await db.query(`SELECT halan_order_id FROM bookings WHERE id = $1 LIMIT 1`, [bookingId]);
        if (res.rows.length > 0) return res.rows[0].halan_order_id;
    }

    if (/^\d+$/.test(rawId)) return Number(rawId);

    throw new AppError('معرف الطلب غير صالح', 400);
}

exports.customerCancel = catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const id = await resolveDeliveryOrderId(req.params.id);
    const order = await deliveryService.customerCancel(id, req.body || {}, io);
    return res.status(200).json({ success: true, message: 'تم إلغاء الطلب بنجاح', order });
});

exports.customerRemoveItem = catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = await resolveDeliveryOrderId(req.params.id);
    const itemIndex = Number(req.body?.itemIndex);
    
    const bookingIdHash = req.body?.bookingId;
    const bookingId = bookingIdHash ? (decodeEntityId('booking', bookingIdHash) || bookingIdHash) : null;

    const order = await deliveryService.customerRemoveItem(id, itemIndex, bookingId, io);
    return res.status(200).json({ success: true, message: 'تم حذف المنتج بنجاح', order });
});

exports.customerAddItemsBulk = catchAsync(async (req, res) => {
    const io = req.app.get('io');
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = await resolveDeliveryOrderId(req.params.id);
    const { items = [], providerId: rawProviderId = null } = req.body || {};
    
    const providerId = rawProviderId ? (decodeEntityId('provider', rawProviderId) || decodeEntityId('user', rawProviderId) || rawProviderId) : null;

    const result = await deliveryService.customerAddItemsBulk(id, items, providerId, io);
    return res.status(200).json({ success: true, message: 'تمت إضافة المنتجات بنجاح', ...result });
});

exports.getOrders = catchAsync(async (req, res, next) => {
    const result = await deliveryService.getOrders(req.user, req.query);
    const records = result.records || [];
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const hasMore = result.hasMore !== undefined ? result.hasMore : (records.length === limit);

    const obfuscated = records.map(o => obfuscateOrder({
        ...o,
        ...(o.sub_orders ? { sub_orders: o.sub_orders.map(s => obfuscateOrder(s)) } : {})
    }));

    res.status(200).json({
        success: true,
        data: obfuscated,
        pagination: {
            total: records.length,
            page,
            limit,
            totalPages: hasMore ? page + 1 : page,
            hasMore,
            nextLastId: result.nextLastId || null
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

    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;

    const order = await deliveryRepo.getOrderByIdSecure(id, { userId, role });
    if (!order) throw new AppError('الطلب غير موجود أو غير مصرح لك بمشاهدته', 404);


    const obfuscatedOrder = obfuscateOrder(order);

    res.status(200).json({ success: true, data: obfuscatedOrder });
});

exports.createOrder = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const io = req.app.get('io');

    const order = await deliveryService.createOrder(userId, role, req.body, io);
    res.status(201).json({ success: true, data: order });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    const io = req.app.get('io');

    await deliveryService.updateStatus(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب بنجاح' });
});

exports.assignCourier = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    const io = req.app.get('io');

    const order = await deliveryService.assignCourier(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تعيين المندوب بنجاح', data: order });
});

exports.updateCourierPricing = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    const io = req.app.get('io');

    const order = await deliveryService.updateCourierPricing(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم حفظ التعديلات بنجاح', data: order });
});

exports.updateOrderMeta = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    const io = req.app.get('io');

    const order = await deliveryService.updateOrderMeta(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تحديث بيانات الطلب', data: order });
});

exports.softDelete = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    await deliveryRepo.softDelete(id);
    res.status(200).json({ success: true, message: 'تم حذف الطلب بنجاح' });
});

exports.autoAssign = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    const { performAutoAssign } = require('../utils/driver-assignment');
    const io = req.app.get('io');

    const result = await performAutoAssign(id, userId, io);
    res.status(200).json({ success: true, message: `تم تعيين الطلب للمسؤول ${result ? result.name : ''}`, supervisor: result });
});

exports.publishOrder = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;
    const io = req.app.get('io');

    const order = await deliveryService.publishOrder(id, userId, role, io);
    res.status(200).json({ success: true, message: 'تم نشر الطلب للمناديب', data: order });
});

exports.updateOrder = catchAsync(async (req, res, next) => {
    const safeData = {};
    if (req.body.status !== undefined) safeData.status = String(req.body.status);
    if (req.body.courier_id !== undefined) safeData.courier_id = req.body.courier_id ? parseInt(req.body.courier_id) : null;
    if (req.body.source !== undefined) safeData.source = req.body.source;
    if (req.body.delivery_fee !== undefined) {
        const parsedFee = Number(req.body.delivery_fee);
        if (!Number.isFinite(parsedFee) || parsedFee < 0) {
            return next(new AppError('سعر التوصيل غير صالح', 400));
        }
        safeData.delivery_fee = parsedFee;
    }

    if (Object.keys(safeData).length === 0) {
        return next(new AppError('لا توجد بيانات صالحة للتحديث', 400));
    }

    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('order', req.params.id) || decodeEntityId('booking', req.params.id) || req.params.id;

    const io = req.app.get('io');
    const updatedOrder = await deliveryService.updateOrder(
        id,
        req.user.id || req.user.userId,
        req.user.role || req.user.type,
        safeData,
        io
    );

    res.status(200).json({
        success: true,
        data: updatedOrder
    });
});
