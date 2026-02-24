const bookingRepo = require('../repositories/booking.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const { createNotification } = require('../routes/notifications');
const { performAutoAssign } = require('../utils/driver-assignment');

const { client: redisClient } = require('../utils/redis');

class BookingService {
    async checkoutTransaction(userId, items, addressInfo, userPrizeId, idempotencyKey = null) {
        let idempotencyLockAcquired = false;

        // 🛡️ True Atomic Enterprise Idempotency Check (Prevents parallel double requests from bypassing cache)
        if (idempotencyKey && redisClient && redisClient.isOpen) {
            const redisKey = `idempotency:checkout:${idempotencyKey}`;

            // Atomically set a PROCESSING lock if the key doesn't exist
            const isNew = await redisClient.setNX(redisKey, 'PROCESSING');

            if (!isNew) {
                // It already exists. Determine if it's still processing or finished.
                const existingVal = await redisClient.get(redisKey);
                if (existingVal === 'PROCESSING') {
                    throw new AppError('طلبك قيد المعالجة بالفعل. يرجى الانتظار لثوانٍ.', 429);
                } else if (existingVal) {
                    logger.info(`♻️ [Idempotency] Returned cached checkout for key: ${idempotencyKey}`);
                    return JSON.parse(existingVal);
                }
            }

            // Lock successfully acquired
            idempotencyLockAcquired = true;
            await redisClient.expire(redisKey, 30); // Prevent deadlock in case of total crash (30s max processing time)
        }

        const client = await bookingRepo.beginTransaction();
        try {
            let totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let totalDiscount = 0;
            let validatedPrize = null;

            if (userPrizeId) {
                const prize = await bookingRepo.getUnusedUserPrize(userPrizeId, userId, client);
                if (!prize) {
                    throw new AppError('عذراً، هذه الجائزة أو الخصم مستخدمة بالفعل أو غير متوفرة.', 400);
                }

                let isApplicable = true;
                if (prize.provider_id) {
                    const hasProviderItems = items.some(item => String(item.providerId) === String(prize.provider_id));
                    if (!hasProviderItems) {
                        isApplicable = false;
                    }
                }

                if (!isApplicable) {
                    throw new AppError('الخصم غير قابل للتطبيق على محتويات السلة الحالية.', 400);
                }

                validatedPrize = prize;
                if (prize.prize_type === 'discount_percent') {
                    const baseForDiscount = prize.provider_id
                        ? items.filter(i => String(i.providerId) === String(prize.provider_id)).reduce((s, i) => s + (i.price * i.quantity), 0)
                        : totalPrice;
                    totalDiscount = baseForDiscount * (prize.prize_value / 100);
                } else if (prize.prize_type === 'discount_flat') {
                    totalDiscount = Math.min(totalPrice, prize.prize_value);
                } else if (prize.prize_type === 'free_delivery') {
                    totalDiscount = 0; // Handled separately in delivery
                }
            }

            const finalPrice = Math.max(0, totalPrice - totalDiscount);
            const parentId = await bookingRepo.createParentOrder(
                userId, finalPrice, totalDiscount,
                validatedPrize ? validatedPrize.id : null,
                addressInfo ? `Phone: ${addressInfo.phone} | Addr: ${addressInfo.area}` : 'No Address',
                JSON.stringify(addressInfo),
                client
            );

            const grouped = {};
            items.forEach(item => {
                if (!grouped[item.providerId]) {
                    grouped[item.providerId] = { providerName: item.providerName, items: [] };
                }
                grouped[item.providerId].items.push(item);
            });

            const bookingIds = [];
            // Simplified userName retrieval (could be passed in req initially)
            const userName = 'عملينا العزيز';

            for (const [pId, group] of Object.entries(grouped)) {
                let providerTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                let providerDiscount = 0;

                if (validatedPrize) {
                    if (!validatedPrize.provider_id || String(validatedPrize.provider_id) === String(pId)) {
                        providerDiscount = validatedPrize.provider_id ? totalDiscount : (providerTotal / totalPrice) * totalDiscount;
                    }
                }

                const finalProviderPrice = Math.max(0, providerTotal - providerDiscount);
                const detailsStr = addressInfo
                    ? `الهاتف: ${addressInfo.phone} | العنوان: ${addressInfo.area} - ${addressInfo.details}`
                    : "تم الطلب من السلة";

                const bId = await bookingRepo.createBookingItem([
                    userId, pId, userName, `طلب منتجات (${group.items.length} أصناف)`,
                    group.providerName, finalProviderPrice, providerDiscount, detailsStr,
                    JSON.stringify(group.items), parentId, `BUNDLE-${parentId}`
                ], client);

                bookingIds.push(bId);
            }

            if (validatedPrize) {
                await bookingRepo.markPrizeAsUsed(bookingIds[0], validatedPrize.id, client);
            }

            await bookingRepo.commitTransaction(client);
            const responseData = { parentId, bookingIds, discount: totalDiscount, finalPrice };

            if (idempotencyLockAcquired && redisClient && redisClient.isOpen) {
                await redisClient.setEx(`idempotency:checkout:${idempotencyKey}`, 86400, JSON.stringify(responseData));
            }

            return responseData;

        } catch (error) {
            await bookingRepo.rollbackTransaction(client);
            if (idempotencyLockAcquired && redisClient && redisClient.isOpen) {
                await redisClient.del(`idempotency:checkout:${idempotencyKey}`);
            }
            logger.error(`Checkout failed for user ${userId}`, error);
            if (error instanceof AppError) throw error;
            throw new AppError('فشل اتمام عملية الدفع', 500);
        }
    }

    async updateBookingStatus(id, status, price, io) {
        const bookingInfo = await bookingRepo.getBookingToUpdate(id);
        if (!bookingInfo) throw new AppError('الحجز غير متوفر', 404);

        // 🛡️ Strict Enterprise State Machine Transition Validation
        const currentStatus = bookingInfo.status;
        const targetStatus = status;

        const validTransitions = {
            'pending': ['confirmed', 'rejected', 'cancelled'],
            'pending_appointment': ['confirmed', 'rejected', 'provider_rescheduled', 'customer_rescheduled', 'cancelled'],
            'confirmed': ['completed', 'cancelled'],
            'completed': [], // Terminal State
            'cancelled': [], // Terminal State
            'rejected': [], // Terminal State
            'provider_rescheduled': ['confirmed', 'cancelled'],
            'customer_rescheduled': ['confirmed', 'cancelled']
        };

        if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(targetStatus)) {
            throw new AppError(`انتقال الحالة غير مسموح به. لا يمكن التغيير من '${currentStatus}' إلى '${targetStatus}'`, 403);
        }

        if (targetStatus === 'rejected') {
            const svcName = bookingInfo.service_name || '';
            const hasHalanOrder = !!bookingInfo.halan_order_id;
            if (svcName.includes('طلب يدوي') || hasHalanOrder) {
                throw new AppError('لا يمكن رفض الطلبات المكتملة يدوياً او بالتوصيل. تواصل مع الإدارة.', 403);
            }
        }

        const result = await bookingRepo.updateBookingStatusAndPrice(id, targetStatus, price);

        const customerId = bookingInfo.user_id;
        const providerUserId = await bookingRepo.getUserIdByProviderId(bookingInfo.provider_id);

        if (io) {
            const payload = { id, status, parentId: bookingInfo.parent_order_id };
            if (customerId) io.to(`user-${customerId}`).emit('booking-updated', payload);
            if (providerUserId) io.to(`user-${providerUserId}`).emit('booking-updated', payload);
            io.to('admin').emit('booking-updated', payload);
        }

        if (bookingInfo.halan_order_id) {
            const halanOrderId = bookingInfo.halan_order_id;
            const deliveryOrder = await bookingRepo.checkDeliveryOrderType(halanOrderId);

            const isManualOrder = deliveryOrder && (
                deliveryOrder.order_type === 'manual' ||
                (deliveryOrder.source && !deliveryOrder.source.includes('qareeblak'))
            );
            const alreadyHasCourier = deliveryOrder && !!deliveryOrder.courier_id;

            let halanStatus = null;
            if (status === 'confirmed') halanStatus = 'pending';
            if (status === 'completed') halanStatus = 'ready_for_pickup';
            if (status === 'cancelled') halanStatus = 'cancelled';

            if (halanStatus) {
                if (isManualOrder || alreadyHasCourier) {
                    await bookingRepo.updateDeliveryOrderStatus(halanOrderId, halanStatus);
                    if (io) io.emit('order-status-changed', { orderId: halanOrderId, status: halanStatus });
                } else if (status === 'completed') {
                    try {
                        const courier = await performAutoAssign(halanOrderId, bookingInfo.provider_id, io, 'ready_for_pickup');
                        if (!courier) {
                            await bookingRepo.updateDeliveryOrderStatus(halanOrderId, halanStatus);
                            if (io) io.emit('order-status-changed', { orderId: halanOrderId, status: halanStatus });
                        }
                    } catch (e) {
                        logger.error('Auto assign failed', e);
                    }
                } else if (halanStatus) {
                    await bookingRepo.updateDeliveryOrderStatus(halanOrderId, halanStatus);
                    if (io) io.emit('order-status-changed', { orderId: halanOrderId, status: halanStatus });
                }
            }
        }

        if (bookingInfo.parent_order_id) {
            await syncParentOrderStatus(bookingInfo.parent_order_id, io);
        }

        return result;
    }

    async reschedule(id, newDate, party, io) {
        const newStatus = party === 'provider' ? 'provider_rescheduled' : 'customer_rescheduled';
        const booking = await bookingRepo.rescheduleBooking(id, newDate, newStatus, party);

        if (!booking) throw new AppError('Booking not found', 404);

        const formattedDate = new Date(newDate).toLocaleString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        if (party === 'provider' && booking.user_id) {
            await createNotification(booking.user_id, `اقترح مقدم الخدمة موعداً جديداً ${formattedDate}`, 'appointment_negotiation', String(id), io);
        } else if (party === 'customer' && booking.provider_id) {
            const providerUserId = await bookingRepo.getUserIdByProviderId(booking.provider_id);
            if (providerUserId) {
                await createNotification(providerUserId, `العميل اقترح موعداً جديداً ${formattedDate}`, 'appointment_negotiation', String(id), io);
            }
        }

        if (io) {
            const payload = { id, status: newStatus, appointmentDate: newDate, lastUpdatedBy: party };
            if (booking.user_id) io.to(`user-${booking.user_id}`).emit('booking-updated', payload);

            const providerUserId = await bookingRepo.getUserIdByProviderId(booking.provider_id);
            if (providerUserId) io.to(`user-${providerUserId}`).emit('booking-updated', payload);
        }

        return booking;
    }

    async confirmAppointment(id, acceptedBy, io) {
        const booking = await bookingRepo.confirmAppointment(id, acceptedBy);
        if (!booking) throw new AppError('Booking not found', 404);

        if (io) {
            if (booking.user_id) {
                await createNotification(booking.user_id, `تم تأكيد موعد طلبك! يمكنك الآن التواصل. 📞`, 'appointment_confirmed', String(id), io);
                io.to(`user-${booking.user_id}`).emit('booking-updated', { id, status: 'confirmed', lastUpdatedBy: acceptedBy });
            }

            const providerUserId = await bookingRepo.getUserIdByProviderId(booking.provider_id);
            if (providerUserId) {
                await createNotification(providerUserId, `تم تأكيد العميل للموعد! يمكنك الآن التواصل. 📞`, 'appointment_confirmed', String(id), io);
                io.to(`user-${providerUserId}`).emit('booking-updated', { id, status: 'confirmed', lastUpdatedBy: acceptedBy });
            }
        }
        return booking;
    }
}

module.exports = new BookingService();
