const bookingService = require('../services/booking.service');
const bookingRepo = require('../repositories/booking.repository');
const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');
const { client: redisClient } = require('../utils/redis');

// [ENTERPRISE] Idempotency TTL (24 hours)
const IDEMPOTENCY_TTL = 24 * 60 * 60;

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
    const cacheKey = `idempotency:checkout:${idempotencyKey}`;

    if (idempotencyKey && redisClient?.status === 'ready') {
        const cachedResponse = await redisClient.get(cacheKey);
        if (cachedResponse) {
            logger.info(`♻️ [IDEMPOTENCY] Returning cached response for key: ${idempotencyKey}`);
            return res.status(200).json(JSON.parse(cachedResponse));
        }
    }

    const checkoutResult = await bookingService.checkoutTransaction(authenticatedUser, items, addressInfo, {
        userPrizeId,
        promoCode,
        useWallet,
        idempotencyKey,
        io: req.app.get('io')
    });

    logger.info(`✅ [Elite] Checkout completed Parent: ${checkoutResult.parentId} for User: ${authenticatedUser}`);
    
    if (idempotencyKey && redisClient?.status === 'ready') {
        await redisClient.set(cacheKey, JSON.stringify({ success: true, message: 'Order placed successfully', ...checkoutResult }), 'EX', IDEMPOTENCY_TTL);
    }

    const { encodeEntityId } = require('../utils/obfuscate');
    const encryptedParentId = checkoutResult.parentId ? encodeEntityId('parent_order', checkoutResult.parentId) : undefined;

    res.status(201).json({ success: true, message: 'Order placed successfully', ...checkoutResult, encryptedParentId });
});

exports.createLegacyBooking = catchAsync(async (req, res, next) => {
    // Only kept for specific manual legacy interactions
    const authenticatedUser = req.user.id;
    const { providerId, serviceId, userName, serviceName, providerName, price, details, items, bundleId, appointmentDate, appointmentType } = req.body;

    const { decodeEntityId } = require('../utils/obfuscate');
    const decodedProviderId = decodeEntityId('provider', providerId) || providerId;
    const decodedServiceId = serviceId ? (decodeEntityId('service', serviceId) || serviceId) : null;

    const status = appointmentType === 'maintenance' ? 'pending_appointment' : 'pending';

    const bId = await bookingRepo.legacyCreateBooking([
        authenticatedUser, 
        decodedProviderId, 
        decodedServiceId, 
        userName, 
        serviceName, 
        providerName,
        price, 
        details || null, 
        JSON.stringify(items || []), 
        status, 
        bundleId || null, 
        appointmentDate || null, 
        appointmentType || 'immediate'
    ]);

    // [NEW] Notify the provider of the new booking/appointment
    const providerUserId = await bookingRepo.getUserIdByProviderId(decodedProviderId);
    if (providerUserId) {
        const { createNotification } = require('../routes/notifications');
        const io = req.app.get('io');
        await createNotification(providerUserId, 'لديك طلب أو موعد جديد!', 'new_order', bId.toString(), io);
    }

    // Auto-update availability slots for playgrounds
    if (appointmentType === 'playground' && details) {
        const serviceRepo = require('../repositories/service_item.repository');
        const sr = new serviceRepo();
        const services = await sr.getByProvider(decodedProviderId);
        const availService = services.find(s => s.name === '__AVAILABILITY__');
        if (availService) {
            let parsedData = null;
            let slots = [];
            try { 
                parsedData = JSON.parse(availService.description); 
                if (Array.isArray(parsedData)) {
                    slots = parsedData;
                } else if (parsedData && Array.isArray(parsedData.slots)) {
                    slots = parsedData.slots;
                }
            } catch (e) { }

            // Extract requested date and times from details
            let requestedDate = null;
            let requestedTimes = [];
            const dateMatch = details.match(/الموعد:\s*([0-9-]{10})/);
            if (dateMatch) requestedDate = dateMatch[1];
            
            const timeMatch = details.match(/الساعات:\s*(.*)/);
            if (timeMatch) {
                requestedTimes = timeMatch[1].split(' و ').map(t => t.trim());
            } else {
                const legacyTimeMatch = details.match(/\(([^)]+)\)/);
                if (legacyTimeMatch) requestedTimes = legacyTimeMatch[1].split(' - ').map(t => t.trim());
            }

            if (requestedDate && requestedTimes.length > 0) {
                let modified = false;
                
                // Update existing slots if they were somehow already in the array
                slots = slots.map(slot => {
                    if (slot.date === requestedDate && requestedTimes.includes(slot.time)) {
                        modified = true;
                        // remove from requestedTimes so we know we matched it
                        requestedTimes = requestedTimes.filter(t => t !== slot.time);
                        return { ...slot, status: 'booked', bookedBy: authenticatedUser };
                    }
                    return slot;
                });
                
                // Add completely new slots that weren't in the array
                for (const time of requestedTimes) {
                    slots.push({
                        date: requestedDate,
                        time: time,
                        status: 'booked',
                        bookedBy: authenticatedUser
                    });
                    modified = true;
                }
                
                if (modified) {
                    let updatedDescription = '';
                    if (parsedData && !Array.isArray(parsedData)) {
                        parsedData.slots = slots;
                        updatedDescription = JSON.stringify(parsedData);
                    } else {
                        updatedDescription = JSON.stringify(slots);
                    }
                    await sr.update(availService.id, decodedProviderId, { description: updatedDescription }, true); // isAdmin=true to bypass constraints
                }
            }
        }
    }

    res.status(201).json({ success: true, message: 'تم إنشاء الحجز بنجاح', id: bId.toString() });
});

exports.getProviderBookings = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const providerId = decodeEntityId('provider', req.params.providerId) || req.params.providerId;
    const { lastId, limit, page } = req.query; // Validated via zod
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);

    // Optional Check: Is the caller actually this provider or an admin?
    const pUserId = await bookingRepo.getUserIdByProviderId(providerId);
    if (String(pUserId) !== String(req.user.id) && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
        throw new AppError('لا تملك صلاحيات استعراض حجوزات هذا المقدم', 403);
    }

    const { records } = await bookingRepo.getBookingsByProvider(providerId, safeLimit, lastId, safePage);

    const nextLastId = records.length > 0 ? records[records.length - 1].id : null;
    const hasMore = records.length === safeLimit;

    const { obfuscateOrder } = require('../utils/obfuscate');
    res.status(200).json({
        bookings: records.map(obfuscateOrder),
        pagination: {
            nextLastId,
            limit: safeLimit,
            page: safePage,
            hasMore
        }
    });
});

exports.getUserBookings = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const userId = decodeEntityId('user', req.params.userId) || req.params.userId;
    const { lastId, limit, page } = req.query;
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);

    if (String(userId) !== String(req.user.id) && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
        throw new AppError('غير مصرح لك بالوصول لطلبات مستخدم آخر', 403);
    }

    const { records } = await bookingRepo.getBookingsByUser(userId, safeLimit, lastId, safePage);

    const nextLastId = records.length > 0 ? records[records.length - 1].id : null;
    const hasMore = records.length === safeLimit;

    const { obfuscateOrder } = require('../utils/obfuscate');
    res.status(200).json({
        bookings: records.map(obfuscateOrder),
        pagination: {
            nextLastId,
            limit: safeLimit,
            page: safePage,
            hasMore
        }
    });
});

exports.getBookingById = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('booking', req.params.id) || decodeEntityId('parent_order', req.params.id) || req.params.id;

    // Handle reserved route keywords
    if (['provider', 'user', 'checkout', 'track'].includes(id)) {
        return next();
    }

    // [SECURITY] Fetch booking with explicit IDOR check info
    const booking = await bookingRepo.getBookingInfoById(id);
    if (!booking) throw new AppError('الحجز غير موجود', 404);

    // [SECURITY] Verify ownership: Admin, Customer of the booking, or the Provider of the booking
    const isCustomer = String(booking.user_id) === String(req.user.id);
    const isProvider = String(booking.providerUserId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin' || req.user.user_type === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
        logger.warn(`🚨 [IDOR ATTEMPT] User ${req.user.id} tried to access booking ${id} belonging to user ${booking.user_id}`);
        throw new AppError('غير مصرح لك برؤية تفاصيل هذا الحجز', 403);
    }

    const { obfuscateOrder } = require('../utils/obfuscate');
    res.status(200).json(obfuscateOrder(booking));
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('booking', req.params.id) || decodeEntityId('order', req.params.id) || decodeEntityId('parent_order', req.params.id) || req.params.id;
    const { status, price } = req.body;

    // Auth Check: Is the caller the provider for this booking or an admin?
    const bookingInfo = await bookingRepo.getBookingToUpdate(id);
    if (!bookingInfo) throw new AppError('Booking not found', 404);

    const providerUserId = bookingInfo.providerUserId;
    if (String(providerUserId || (await bookingRepo.getUserIdByProviderId(bookingInfo.provider_id))) !== String(req.user.id) && req.user.role !== 'admin' && req.user.user_type !== 'admin') {
        throw new AppError('غير مصرح تغيير حالة هذا الطلب', 403);
    }

    await bookingService.updateBookingStatus(id, status, price, req.app.get('io'));
    res.status(200).json({ success: true, message: 'تم تحديث حالة الحجز بنجاح' });
});

exports.rescheduleAppointment = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('booking', req.params.id) || decodeEntityId('order', req.params.id) || decodeEntityId('parent_order', req.params.id) || req.params.id;
    const { newDate } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    // [SECURITY] Force party identification from session/JWT role, not client body
    // This prevents a customer from pretending to be a provider or vice versa
    const isProvider = req.user.user_type === 'provider';
    const party = isProvider ? 'provider' : 'customer';

    // [SECURITY] IDOR Check: Ensure user is authorized for this specific booking
    const bookingInfo = await bookingRepo.getBookingToUpdate(id);
    if (!bookingInfo) throw new AppError('الحجز غير موجود', 404);

    const isAuthorized = isProvider
        ? String(bookingInfo.provider_id) === String(req.user.provider_id || (await bookingRepo.getProviderIdByUserId(req.user.id)))
        : String(bookingInfo.user_id) === String(req.user.id);

    if (!isAuthorized && req.user.role !== 'admin') {
        throw new AppError('غير مصرح لك بتعديل موعد هذا الحجز', 403);
    }

    const cacheKey = `idempotency:reschedule:${idempotencyKey}`;
    if (idempotencyKey && redisClient?.status === 'ready') {
        const cachedResponse = await redisClient.get(cacheKey);
        if (cachedResponse) return res.status(200).json(JSON.parse(cachedResponse));
    }

    const booking = await bookingService.reschedule(id, newDate, party, req.app.get('io'));
    
    if (idempotencyKey && redisClient?.status === 'ready') {
        await redisClient.set(cacheKey, JSON.stringify({ success: true, message: 'تم تغيير الموعد بنجاح', booking }), 'EX', IDEMPOTENCY_TTL);
    }

    res.status(200).json({ success: true, message: 'تم تغيير الموعد بنجاح', booking });
});

exports.acceptAppointment = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('booking', req.params.id) || decodeEntityId('order', req.params.id) || decodeEntityId('parent_order', req.params.id) || req.params.id;

    // [SECURITY] IDOR & Role Logic:
    // If a provider rescheduled, ONLY the customer can accept.
    // If a customer rescheduled, ONLY the provider can accept.
    const bookingInfo = await bookingRepo.getBookingToUpdate(id);
    if (!bookingInfo) throw new AppError('الحجز غير موجود', 404);

    const isCustomer = String(bookingInfo.user_id) === String(req.user.id);
    const providerUserId = bookingInfo.providerUserId;
    const isProvider = String(providerUserId || (await bookingRepo.getUserIdByProviderId(bookingInfo.provider_id))) === String(req.user.id);

    // Determine who is accepting based on their identity
    const acceptedBy = isProvider ? 'provider' : (isCustomer ? 'customer' : null);

    if (!acceptedBy && req.user.role !== 'admin') {
        throw new AppError('غير مصرح لك بتأكيد هذا الموعد', 403);
    }

    // Logic for transition check: Can't accept your own suggestion
    if (bookingInfo.status === 'provider_rescheduled' && acceptedBy === 'provider') {
        throw new AppError('يجب انتظار رد العميل على اقتراحك', 400);
    }
    if (bookingInfo.status === 'customer_rescheduled' && acceptedBy === 'customer') {
        throw new AppError('يجب انتظار رد مقدم الخدمة على اقتراحك', 400);
    }

    const booking = await bookingService.confirmAppointment(id, acceptedBy, req.app.get('io'));
    res.status(200).json({ success: true, message: 'تم تأكيد الموعد بنجاح', booking });
});

exports.reorder = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('booking', req.params.id) || decodeEntityId('order', req.params.id) || decodeEntityId('parent_order', req.params.id) || req.params.id;
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
