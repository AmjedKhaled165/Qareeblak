const bookingRepo = require('../repositories/booking.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const { createNotification } = require('../routes/notifications');
const { performAutoAssign } = require('../utils/driver-assignment');

const { client: redisClient } = require('../utils/redis');

class BookingService {
    async checkoutTransaction(userId, items, addressInfo, options = {}) {
        const { userPrizeId, promoCode, useWallet, idempotencyKey } = options;

        const lockValue = await redisClient.set(`lock:checkout:user:${userId}`, 'LOCKED', {
            NX: true,
            PX: 30000
        });

        if (!lockValue && !idempotencyKey) {
            throw new AppError('Process in progress. Please wait.', 429);
        }

        let idempotencyLockAcquired = false;
        if (idempotencyKey && redisClient && redisClient.status === 'ready') {
            const redisKey = `idempotency:checkout:${idempotencyKey}`;
            const isNew = await redisClient.set(redisKey, 'PROCESSING', { NX: true, EX: 30 });
            if (!isNew) {
                const existingVal = await redisClient.get(redisKey);
                if (existingVal === 'PROCESSING') throw new AppError('Processing...', 429);
                if (existingVal) return JSON.parse(existingVal);
            }
            idempotencyLockAcquired = true;
        }

        const client = await bookingRepo.beginTransaction();
        const vault = require('../utils/vault');
        const { WalletService, PromoService } = require('./loyalty.service');

        try {
            // [ENTERPRISE SECURITY PATCH] Zero-Trust Client Pricing
            // Re-fetch correct prices from database to prevent Price Tampering/Manipulation
            for (let i = 0; i < items.length; i++) {
                // Assuming items contain a service ID. Custom items without valid DB IDs will retain their price (if allowed by business logic)
                if (items[i].id && !String(items[i].id).startsWith('custom_')) {
                    const priceCheck = await client.query('SELECT price FROM services WHERE id = $1', [items[i].id]);
                    if (priceCheck.rows.length > 0) {
                        items[i].price = Number(priceCheck.rows[0].price);
                    }
                }
            }

            let totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let totalDiscount = 0;
            let validatedPrizeId = null;

            // 1. Handle Spinner Prize
            if (userPrizeId) {
                const prize = await bookingRepo.getUnusedUserPrize(userPrizeId, userId, client);
                if (!prize) throw new AppError('Prize already used', 400);
                validatedPrizeId = prize.id;
                if (prize.prize_type === 'discount_percent') {
                    totalDiscount += totalPrice * (prize.prize_value / 100);
                } else if (prize.prize_type === 'discount_flat') {
                    totalDiscount += prize.prize_value;
                }
            }

            // 2. Handle Promo Code
            if (promoCode) {
                const promoResult = await PromoService.validateCode(promoCode, totalPrice, client);
                totalDiscount += promoResult.discount;
                await PromoService.incrementUsage(promoResult.promoId, client);
            }

            let finalPrice = Math.max(0, totalPrice - totalDiscount);

            // 3. Handle Wallet Deduction
            let walletDeduction = 0;
            if (useWallet) {
                const wallet = await WalletService.getOrCreateWallet(userId, client);
                walletDeduction = Math.min(wallet.balance, finalPrice);
                if (walletDeduction > 0) {
                    await WalletService.updateBalance(userId, -walletDeduction, 'debit', 'order_payment', 'PENDING', client);
                    finalPrice -= walletDeduction;
                }
            }

            const encryptedAddress = addressInfo ? vault.encrypt(JSON.stringify(addressInfo)) : null;
            const summaryStr = addressInfo ? `Phone: ${addressInfo.phone} | Wallet: ${walletDeduction} EGP` : 'No Address';

            const parentId = await bookingRepo.createParentOrder(
                userId, finalPrice, totalDiscount, validatedPrizeId,
                summaryStr, encryptedAddress, client
            );

            // Create bookings grouped by provider
            const grouped = {};
            items.forEach(item => {
                if (!grouped[item.providerId]) grouped[item.providerId] = { providerName: item.providerName, items: [] };
                grouped[item.providerId].items.push(item);
            });

            const bookingIds = [];
            for (const [pId, group] of Object.entries(grouped)) {
                // [FIX] Calculate subtotal for THIS provider only, not the parent total
                const providerSubtotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                // Apply proportional discount if prize was global, or full discount if provider-specific
                let providerDiscount = 0;
                if (totalDiscount > 0) {
                    providerDiscount = (providerSubtotal / totalPrice) * totalDiscount;
                }
                const providerFinalPrice = Math.max(0, providerSubtotal - providerDiscount);

                const bId = await bookingRepo.createBookingItem([
                    userId, pId, 'User', `Order #${parentId}`,
                    group.providerName, providerFinalPrice, providerDiscount, summaryStr,
                    JSON.stringify(group.items), parentId, `BUNDLE-${parentId}`
                ], client);
                bookingIds.push(bId);
            }

            if (validatedPrizeId) await bookingRepo.markPrizeAsUsed(bookingIds[0], validatedPrizeId, client);

            await client.query('COMMIT');
            client.release();

            const resData = { parentId, bookingIds, finalPrice, walletUsed: walletDeduction };
            if (idempotencyLockAcquired) await redisClient.setEx(`idempotency:checkout:${idempotencyKey}`, 86400, JSON.stringify(resData));

            return resData;
        } catch (error) {
            await client.query('ROLLBACK');
            client.release();
            if (idempotencyLockAcquired) await redisClient.del(`idempotency:checkout:${idempotencyKey}`);
            throw error;
        } finally {
            await redisClient.del(`lock:checkout:user:${userId}`);
        }
    }

    async updateBookingStatus(id, status, price, io) {
        // [ENTERPRISE HARDENING] Single-step Atomic Transition
        const validTransitions = {
            'pending': ['confirmed', 'rejected', 'cancelled'],
            'pending_appointment': ['confirmed', 'rejected', 'provider_rescheduled', 'customer_rescheduled', 'cancelled'],
            'confirmed': ['completed', 'cancelled'],
            'completed': [], // Terminal
            'cancelled': [], // Terminal
            'rejected': [], // Terminal
            'provider_rescheduled': ['confirmed', 'cancelled'],
            'customer_rescheduled': ['confirmed', 'cancelled']
        };

        // We need to know current status to find valid expected predecessors
        const currentBooking = await bookingRepo.getBookingToUpdate(id);
        if (!currentBooking) throw new AppError('الحجز غير متوفر', 404);

        const predecessors = Object.keys(validTransitions).filter(src =>
            validTransitions[src].includes(status)
        );

        const result = await bookingRepo.updateBookingStatusAtomic(id, predecessors, status, price);

        if (!result) {
            // If update failed, it's either an invalid transition or someone else changed it first
            throw new AppError(`عذراً، فشلت عملية تغيير الحالة. قد يكون الطلب قد تغيرت حالته بالفعل أو الانتقال غير مسموح به من الحالة الحالية.`, 400);
        }

        const bookingInfo = result; // Use the freshly updated row data

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
