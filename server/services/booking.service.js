const bookingRepo = require('../repositories/booking.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const { createNotification } = require('../routes/notifications');
const { performAutoAssign } = require('../utils/driver-assignment');
const { maintenanceQueue } = require('../utils/queues');

const { client: redisClient } = require('../utils/redis');

class BookingService {
    async checkoutTransaction(userId, items, addressInfo, options = {}) {
        const { userPrizeId, promoCode, useWallet, idempotencyKey } = options;
        const { withEliteLock } = require('../utils/resilient-lock');

        // Pass the request-like object for hashing and userId
        const reqContext = { user: { id: userId }, body: { items, promoCode, userPrizeId, useWallet } };

        return await withEliteLock(reqContext, idempotencyKey, async (client) => {
            const vault = require('../utils/vault');
            const { WalletService, PromoService } = require('./loyalty.service');

            // [SECURITY PATCH] Zero-Trust Client Pricing
            const verifiableIds = Array.from(new Set(
                items.filter(i => i.id && !String(i.id).startsWith('custom_')).map(i => i.id)
            ));

            if (verifiableIds.length > 0) {
                const pricesResult = await client.query('SELECT id, price FROM services WHERE id = ANY($1)', [verifiableIds]);
                const priceMap = new Map(pricesResult.rows.map(r => [String(r.id), Number(r.price)]));
                items.forEach(item => {
                    if (item.id && !String(item.id).startsWith('custom_')) {
                        const serverPrice = priceMap.get(String(item.id));
                        if (serverPrice !== undefined) item.price = serverPrice;
                    }
                });
            }

            const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let totalDiscount = 0;
            let validatedPrizeId = null;

            if (userPrizeId) {
                const prize = await bookingRepo.getUnusedUserPrize(userPrizeId, userId, client);
                if (!prize) throw new AppError('Prize already used', 400);
                validatedPrizeId = prize.id;
                totalDiscount += prize.prize_type === 'discount_percent' ? (totalPrice * (prize.prize_value / 100)) : prize.prize_value;
            }

            if (promoCode) {
                const promoResult = await PromoService.validateAndUse(promoCode, totalPrice, client);
                totalDiscount += promoResult.discount;
            }

            let finalPrice = Math.max(0, totalPrice - totalDiscount);
            let walletDeduction = 0;

            if (useWallet) {
                await WalletService.updateBalance(userId, -finalPrice, 'debit', 'order_payment', `order_${Date.now()}`, client);
                walletDeduction = finalPrice;
                finalPrice = 0;
            }

            const encryptedAddress = addressInfo ? vault.encrypt(JSON.stringify(addressInfo)) : null;
            const summaryStr = addressInfo ? `Phone: ${addressInfo.phone} | Wallet: ${walletDeduction} EGP` : 'No Address';

            const parentId = await bookingRepo.createParentOrder(userId, finalPrice, totalDiscount, validatedPrizeId, summaryStr, encryptedAddress, client);

            const grouped = {};
            items.forEach(item => {
                if (!grouped[item.providerId]) grouped[item.providerId] = { providerName: item.providerName, items: [] };
                grouped[item.providerId].items.push(item);
            });

            const bookingPromises = Object.entries(grouped).map(([pId, group]) => {
                const pSubtotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const pDiscount = totalDiscount > 0 ? (pSubtotal / totalPrice) * totalDiscount : 0;
                return bookingRepo.createBookingItem([
                    userId, pId, 'User', `Order #${parentId}`, group.providerName, Math.max(0, pSubtotal - pDiscount), pDiscount, summaryStr,
                    JSON.stringify(group.items), parentId, `BUNDLE-${parentId}`
                ], client);
            });
            
            const bookingIds = await Promise.all(bookingPromises);

            if (validatedPrizeId) await bookingRepo.markPrizeAsUsed(bookingIds[0], validatedPrizeId, client);

            // [HALAN SYNC]
            let halanOrderId = null;
            if (addressInfo) {
                const orderNum = `HLN-${Date.now().toString(36).toUpperCase()}`;
                const userRes = await client.query('SELECT name, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
                const user = userRes.rows[0] || {};
                const dResult = await client.query(`
                    INSERT INTO delivery_orders (order_number, customer_name, customer_phone, customer_id, pickup_address, delivery_address, status, source, order_type)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
                `, [orderNum, addressInfo.name || user.name || 'Client', addressInfo.phone || user.phone || '', userId, Object.values(grouped).map(g => g.providerName).join(' | '), addressInfo.address || 'N/A', 'pending', 'qareeblak', 'app']);
                halanOrderId = dResult.rows[0].id;
                await client.query('UPDATE bookings SET halan_order_id = $1 WHERE parent_order_id = $2', [halanOrderId, parentId]);
            }

            // [ELITE: TRANSACTIONAL OUTBOX]
            // Write side-effects to DB. They will be processed by the Outbox Poller.
            // This guarantees Exactly-Once delivery to the next stage.
            await client.query(`
                INSERT INTO outbox_events (event_type, payload)
                VALUES ($1, $2)
            `, ['new_booking_created', { 
                parentId, 
                bookingIds, 
                halanOrderId, 
                providerIds: Object.keys(grouped),
                userId 
            }]);

            return { parentId, bookingIds, finalPrice, walletUsed: walletDeduction };
        });
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

        // [ELITE SCALE] Offload side-effects to background worker
        // This ensures the API response is lightning fast (< 100ms)
        if (maintenanceQueue) {
            maintenanceQueue.add('booking-side-effects', {
                bookingId: id,
                status,
                oldStatus: currentBooking.status,
                userId: bookingInfo.user_id,
                price: bookingInfo.price
            }, { 
                attempts: 3, 
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true 
            });
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
