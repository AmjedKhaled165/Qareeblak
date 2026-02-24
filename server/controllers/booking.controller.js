const bookingService = require('../services/booking.service');
const bookingRepo = require('../repositories/booking.repository');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

exports.checkout = catchAsync(async (req, res, next) => {
    // Schema validates items array and contents
    const { userId, items, addressInfo, userPrizeId } = req.body;

    // Safety check - force match the token executing user to the request body to prevent IDOR locally or remove relying on body
    const authenticatedUser = req.user.id;
    if (String(userId) !== String(authenticatedUser)) {
        throw new AppError('لا تملك الصلاحية لإتمام هذا الطلب', 403);
    }

    const idempotencyKey = req.headers['idempotency-key'] || null;

    const checkoutResult = await bookingService.checkoutTransaction(authenticatedUser, items, addressInfo, userPrizeId, idempotencyKey);

    logger.info(`Checkout completed Parent: ${checkoutResult.parentId}`);
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
