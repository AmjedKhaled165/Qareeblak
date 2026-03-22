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

        let lockValue = 'LOCKED';
        try {
            if (redisClient && redisClient.status === 'ready') {
                lockValue = await redisClient.set(`lock:checkout:user:${userId}`, 'LOCKED', 'PX', 30000, 'NX');
            }
        } catch (redisErr) {
            logger.warn(`Checkout lock skipped for user ${userId}: ${redisErr.message}`);
        }

        if (!lockValue && !idempotencyKey) {
            throw new AppError('Process in progress. Please wait.', 429);
        }

        let idempotencyLockAcquired = false;
        if (idempotencyKey && redisClient && redisClient.status === 'ready') {
            try {
                const redisKey = `idempotency:checkout:${idempotencyKey}`;
                const isNew = await redisClient.set(redisKey, 'PROCESSING', 'EX', 30, 'NX');
                if (!isNew) {
                    const existingVal = await redisClient.get(redisKey);
                    if (existingVal === 'PROCESSING') throw new AppError('Processing...', 429);
                    if (existingVal) return JSON.parse(existingVal);
                }
                idempotencyLockAcquired = true;
            } catch (redisErr) {
                logger.warn(`Checkout idempotency lock skipped for key ${idempotencyKey}: ${redisErr.message}`);
            }
        }

        const client = await bookingRepo.beginTransaction();
        const vault = require('../utils/vault');
        const { WalletService, PromoService } = require('./loyalty.service');
        let transactionCommitted = false;

        try {
            // [ENTERPRISE SECURITY PATCH] Zero-Trust Client Pricing — Batch Version
            // Single IN query replaces N sequential SELECTs (was O(n) round-trips)
            const verifiableIds = Array.from(new Set(
                items
                    .filter(i => i.id && !String(i.id).startsWith('custom_'))
                    .map(i => i.id)
            ));

            if (verifiableIds.length > 0) {
                const pricesResult = await client.query(
                    'SELECT id, price FROM services WHERE id = ANY($1)',
                    [verifiableIds]
                );
                const priceMap = new Map(
                    pricesResult.rows.map(r => [String(r.id), Number(r.price)])
                );
                items.forEach(item => {
                    if (item.id && !String(item.id).startsWith('custom_')) {
                        const serverPrice = priceMap.get(String(item.id));
                        if (serverPrice !== undefined) item.price = serverPrice;
                    }
                });
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
            // 🚀 [HALAN INTEGRATION] Auto-create Delivery Order for Qareeblak Orders
            let halanOrderId = null;
            if (addressInfo) {
                const orderNum = `HLN-APP-${Date.now().toString(36).toUpperCase()}`;
                const notes = addressInfo.notes || `طلب مجمع #${parentId}`;
                
                const dResult = await client.query(`
                    INSERT INTO delivery_orders 
                    (order_number, customer_name, customer_phone, delivery_address, delivery_lat, delivery_lng, status, notes, items, source, order_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
                `, [
                    orderNum, addressInfo.name || 'عميل Qareeblak', addressInfo.phone || '', 
                    addressInfo.address || addressInfo.street || 'بدون عنوان',
                    addressInfo.lat || null, addressInfo.lng || null,
                    'pending', notes, JSON.stringify(items), 'qareeblak', 'app'
                ]);
                
                halanOrderId = dResult.rows[0].id;
                
                // Link all bookings in this parent to the new halan_order_id
                await client.query(`UPDATE bookings SET halan_order_id = $1 WHERE parent_order_id = $2`, [halanOrderId, parentId]);
            }

            await client.query('COMMIT');
            transactionCommitted = true;
            client.release();

            // 📢 [REALTIME NOTIFICATIONS] Inform providers via socket
            if (options.io) {
                for (const pId of Object.keys(grouped)) {
                    options.io.to(`provider-${pId}`).emit('new_booking', {
                        parentId,
                        message: 'لديك طلب جديد!'
                    });
                }
            }

            // 🚚 [AUTO ASSIGN] Trigger courier assignment after commit
            if (halanOrderId) {
                try {
                    const { performAutoAssign } = require('../utils/driver-assignment');
                    await performAutoAssign(halanOrderId, Object.keys(grouped)[0], options.io, 'assigned');
                } catch (assignError) {
                    logger.error(`[Halan AutoAssign] Failed for order ${halanOrderId}`, assignError);
                }
            }

            const resData = { parentId, bookingIds, finalPrice, walletUsed: walletDeduction };
            if (idempotencyLockAcquired) {
                try {
                    await redisClient.set(`idempotency:checkout:${idempotencyKey}`, JSON.stringify(resData), 'EX', 86400);
                } catch (cacheError) {
                    logger.warn(`Failed to persist checkout idempotency key ${idempotencyKey}: ${cacheError.message}`);
                }
            }

            return resData;
        } catch (error) {
            if (!transactionCommitted) {
                await client.query('ROLLBACK');
                client.release();
            }
            if (idempotencyLockAcquired) {
                try {
                    await redisClient.del(`idempotency:checkout:${idempotencyKey}`);
                } catch (redisErr) {
                    logger.warn(`Failed to clear idempotency key ${idempotencyKey}: ${redisErr.message}`);
                }
            }
            throw error;
        } finally {
            try {
                if (redisClient && redisClient.status === 'ready') {
                    await redisClient.del(`lock:checkout:user:${userId}`);
                }
            } catch (redisErr) {
                logger.warn(`Failed to release checkout lock for user ${userId}: ${redisErr.message}`);
            }
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
        // providerUserId is now returned directly from getBookingToUpdate JOIN — no extra DB call
        const providerUserId = bookingInfo.providerUserId;

        if (io) {
            const payload = { id, status, parentId: bookingInfo.parent_order_id };
            if (customerId) io.to(`user-${customerId}`).emit('booking-updated', payload);
            if (providerUserId) io.to(`user-${providerUserId}`).emit('booking-updated', payload);
            io.to('admin').emit('booking-updated', payload);
        }

        let halanOrderId = bookingInfo.halan_order_id;

        // Legacy recovery: some old bookings were confirmed/completed before halan_order_id linkage existed.
        if (!halanOrderId && (status === 'confirmed' || status === 'completed')) {
            try {
                halanOrderId = await bookingRepo.createDeliveryOrderForBooking(bookingInfo);
                if (halanOrderId) {
                    bookingInfo.halan_order_id = halanOrderId;
                    logger.info(`Linked legacy booking ${id} to new delivery order ${halanOrderId}`);
                }
            } catch (linkErr) {
                logger.error(`Failed to link booking ${id} to delivery order`, linkErr);
            }
        }

        if (halanOrderId) {
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

        // 💸 Financial Calculation for Admin & Provider (Only on completion)
        // commissionRate comes from the getBookingToUpdate JOIN — no extra DB call
        if (status === 'completed' && bookingInfo.price > 0) {
            try {
                const rate = Number(bookingInfo.commissionRate) || 10.00;
                const commission = (bookingInfo.price * (rate / 100));
                const net = bookingInfo.price - commission;

                await bookingRepo.updateBookingFinancials(id, commission, net);
                logger.info(`💸 Financials calculated for booking ${id}: Comm: ${commission}, Net: ${net}`);
            } catch (err) {
                logger.error(`💥 Failed to calculate financials for booking ${id}:`, err);
            }
        }

        // 🛡️ Anti-Fraud: Track user cancellations
        if (status === 'cancelled' && bookingInfo.user_id) {
            try {
                await bookingRepo.incrementUserCancellation(bookingInfo.user_id);
                logger.warn(`🛡️ User ${bookingInfo.user_id} cancelled booking ${id}. Tracking for anti-fraud.`);
            } catch (err) {
                logger.error(`💥 Failed to increment cancellation count for user ${bookingInfo.user_id}:`, err);
            }
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

        // Fetch providerUserId ONCE and reuse for both notification and socket (was called twice)
        let providerUserId = null;
        if (booking.provider_id) {
            providerUserId = await bookingRepo.getUserIdByProviderId(booking.provider_id);
        }

        if (party === 'provider' && booking.user_id) {
            await createNotification(booking.user_id, `اقترح مقدم الخدمة موعداً جديداً ${formattedDate}`, 'appointment_negotiation', String(id), io);
        } else if (party === 'customer' && providerUserId) {
            await createNotification(providerUserId, `العميل اقترح موعداً جديداً ${formattedDate}`, 'appointment_negotiation', String(id), io);
        }

        if (io) {
            const payload = { id, status: newStatus, appointmentDate: newDate, lastUpdatedBy: party };
            if (booking.user_id) io.to(`user-${booking.user_id}`).emit('booking-updated', payload);
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
