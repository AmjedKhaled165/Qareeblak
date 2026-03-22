const bookingService = require('../services/booking.service');
const bookingRepo = require('../repositories/booking.repository');
const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

/**
 * GET /bookings — Admin-only: Retrieve all platform bookings with cursor pagination
 * Uses cursor-based (keyset) pagination for O(log N) performance at scale
 */
exports.getAllBookings = catchAsync(async (req, res, next) => {
    const { lastId, limit = '50' } = req.query;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    let query, params;
    if (lastId) {
        query = `
            SELECT b.id, b.user_name AS "userName", b.service_name AS "serviceName",
                   b.provider_name AS "providerName", b.provider_id AS "providerId",
                   b.user_id AS "userId", b.status, b.price, b.discount_amount AS "discountAmount",
                   b.booking_date AS date, b.parent_order_id AS "parentOrderId",
                   b.halan_order_id AS "halanOrderId"
            FROM bookings b
            WHERE b.id < $1
            ORDER BY b.id DESC
            LIMIT $2
        `;
        params = [lastId, safeLimit];
    } else {
        query = `
            SELECT b.id, b.user_name AS "userName", b.service_name AS "serviceName",
                   b.provider_name AS "providerName", b.provider_id AS "providerId",
                   b.user_id AS "userId", b.status, b.price, b.discount_amount AS "discountAmount",
                   b.booking_date AS date, b.parent_order_id AS "parentOrderId",
                   b.halan_order_id AS "halanOrderId"
            FROM bookings b
            ORDER BY b.id DESC
            LIMIT $1
        `;
        params = [safeLimit];
    }

    const result = await db.query(query, params);
    const rows = result.rows;

    res.status(200).json({
        bookings: rows,
        pagination: {
            nextLastId: rows.length > 0 ? rows[rows.length - 1].id : null,
            limit: safeLimit,
            hasMore: rows.length === safeLimit
        }
    });
});


exports.checkout = catchAsync(async (req, res, next) => {
    const { userId, items, addressInfo, userPrizeId, promoCode, useWallet } = req.body;

    const authenticatedUser = req.user.id;
    if (userId !== undefined && userId !== null && String(userId) !== String(authenticatedUser)) {
        throw new AppError('Unauthorized checkout attempt', 403);
    }

    // 🛡️ [No Mercy Anti-Fraud]
    // Block users with more than 5 cancellations to protect providers from time-wasters
    if (req.user.cancellation_count > 5 && req.user.role !== 'admin') {
        logger.warn(`🛑 Fraud Alert: User ${authenticatedUser} blocked from checkout (Cancellations: ${req.user.cancellation_count})`);
        throw new AppError('تم حظر إتمام الطلبات لحسابك بسبب كثرة الإلغاءات السابقة. يرجى التواصل مع الدعم الفني.', 403);
    }

    const idempotencyKey = req.headers['idempotency-key'] || null;

    const checkoutResult = await bookingService.checkoutTransaction(authenticatedUser, items, addressInfo, {
        userPrizeId,
        promoCode,
        useWallet,
        idempotencyKey,
        io: req.app.get('io')
    });

    logger.info(`✅ [Elite] Checkout completed Parent: ${checkoutResult.parentId} for User: ${authenticatedUser}`);
    res.status(201).json({ success: true, message: 'Order placed successfully', ...checkoutResult });
});

exports.createLegacyBooking = catchAsync(async (req, res, next) => {
    // Only kept for specific manual legacy interactions
    const authenticatedUser = req.user.id;
    const { providerId, serviceId, userName, serviceName, providerName, price, details, items, bundleId, appointmentDate, appointmentType } = req.body;

    const status = appointmentType === 'maintenance' ? 'pending_appointment' : 'pending';

    const bId = await bookingRepo.legacyCreateBooking([
        authenticatedUser, providerId, serviceId, userName, serviceName, providerName,
        price, details, JSON.stringify(items || []), status, bundleId, appointmentDate || null, appointmentType || 'immediate'
    ]);

    res.status(201).json({ success: true, message: 'تم إنشاء الحجز بنجاح', id: bId.toString() });
});

exports.getProviderBookings = catchAsync(async (req, res, next) => {
    const { providerId } = req.params;
    const { lastId, limit } = req.query; // Validated via zod

    // Optional Check: Is the caller actually this provider or an admin?
    const pUserId = await bookingRepo.getUserIdByProviderId(providerId);
    if (String(pUserId) !== String(req.user.id) && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
        throw new AppError('لا تملك صلاحيات استعراض حجوزات هذا المقدم', 403);
    }

    const { records } = await bookingRepo.getBookingsByProvider(providerId, limit, lastId);

    const nextLastId = records.length > 0 ? records[records.length - 1].id : null;
    const hasMore = records.length === limit;

    res.status(200).json({
        bookings: records,
        pagination: {
            nextLastId,
            limit,
            hasMore
        }
    });
});

exports.getUserBookings = catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    const { lastId, limit } = req.query;

    if (String(userId) !== String(req.user.id) && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
        throw new AppError('غير مصرح لك بالوصول لطلبات مستخدم آخر', 403);
    }

    const { records } = await bookingRepo.getBookingsByUser(userId, limit, lastId);

    const nextLastId = records.length > 0 ? records[records.length - 1].id : null;
    const hasMore = records.length === limit;

    res.status(200).json({
        bookings: records,
        pagination: {
            nextLastId,
            limit,
            hasMore
        }
    });
});

exports.getBookingById = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (['provider', 'user', 'checkout', 'track'].includes(id)) {
        return next();
    }

    const booking = await bookingRepo.getBookingInfoById(id);
    if (!booking) throw new AppError('Booking not found', 404);

    if (String(booking.user_id) !== String(req.user.id) && String(booking.providerUserId) !== String(req.user.id) && req.user.role !== 'admin') {
        throw new AppError('غير مصرح لك برؤية هذه التفاصيل', 403);
    }

    res.status(200).json(booking);
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status, price } = req.body;

    // Auth Check: Is the caller the provider for this booking or an admin?
    const bookingInfo = await bookingRepo.getBookingToUpdate(id);
    if (!bookingInfo) throw new AppError('Booking not found', 404);

    const pUserId = await bookingRepo.getUserIdByProviderId(bookingInfo.provider_id);
    if (String(pUserId) !== String(req.user.id) && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
        throw new AppError('غير مصرح تغيير حالة هذا الطلب', 403);
    }

    await bookingService.updateBookingStatus(id, status, price, req.app.get('io'));
    res.status(200).json({ success: true, message: 'تم تحديث حالة الحجز بنجاح' });
});

exports.rescheduleAppointment = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { newDate, updatedBy } = req.body;

    const booking = await bookingService.reschedule(id, newDate, updatedBy, req.app.get('io'));
    res.status(200).json({ success: true, message: 'تم تغيير الموعد بنجاح', booking });
});

exports.acceptAppointment = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const acceptedBy = req.body.acceptedBy || 'customer';

    const booking = await bookingService.confirmAppointment(id, acceptedBy, req.app.get('io'));
    res.status(200).json({ success: true, message: 'تم تأكيد الموعد بنجاح', booking });
});

exports.reorder = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const booking = await bookingRepo.getBookingInfoById(id);
    if (!booking) throw new AppError('Booking not found', 404);

    if (String(booking.user_id) !== String(req.user.id)) {
        throw new AppError('Unauthorized reorder attempt', 403);
    }

    const items = typeof booking.items === 'string' ? JSON.parse(booking.items) : (booking.items || []);
    if (items.length === 0) throw new AppError('No items found in previous booking', 400);

    const reorderResult = await bookingService.checkoutTransaction(req.user.id, items, booking.address_info, {
        useWallet: false
    });

    res.status(201).json({ success: true, message: 'Reordered successfully', ...reorderResult });
});
