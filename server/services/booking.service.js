const bookingRepo = require('../repositories/booking.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { generateTrackingCode } = require('../utils/generate-tracking-code');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const { createNotification } = require('../routes/notifications');
const { performAutoAssign } = require('../utils/driver-assignment');
const { maintenanceQueue } = require('../utils/queues');
const db = require('../db');

const { client: redisClient } = require('../utils/redis');

class BookingService {
    async checkoutTransaction(userId, items, addressInfo, options = {}) {
        const { userPrizeId, promoCode, useWallet, idempotencyKey, io } = options;
        const { withEliteLock } = require('../utils/resilient-lock');

        // Pass the request-like object for hashing and userId
        const reqContext = { user: { id: userId }, body: { items, promoCode, userPrizeId, useWallet } };

        const result = await withEliteLock(reqContext, idempotencyKey, async (client) => {
            const vault = require('../utils/vault');
            const { WalletService, PromoService } = require('./loyalty.service');

            // [SECURITY PATCH] Zero-Trust Client Pricing
            const { decodeEntityId } = require('../utils/obfuscate');
            const verifiableIds = Array.from(new Set(
                items.filter(i => i.id && !String(i.id).startsWith('custom_')).map(i => Number(i.id))
            ));

            if (items.some(i => !i.id || String(i.id).startsWith('custom_'))) {
                throw new AppError('يجب أن تحتوي كل الخدمات على معرف صالح من المتجر', 400);
            }

            if (verifiableIds.length > 0) {
                const pricesResult = await client.query('SELECT id, price, provider_id FROM services WHERE id = ANY($1)', [verifiableIds]);
                const priceMap = new Map(pricesResult.rows.map(r => [Number(r.id), { price: Number(r.price), providerId: Number(r.provider_id) }]));

                for (const item of items) {
                    const itemId = Number(item.id);
                    const dbService = priceMap.get(itemId);
                    if (!dbService) {
                        throw new AppError(`الخدمة أو المنتج غير متوفر حالياً`, 400);
                    }

                    const decodedProviderId = Number(decodeEntityId('provider', item.providerId) || item.providerId);
                    if (dbService.providerId !== decodedProviderId) {
                        throw new AppError('معلومات الخدمة ومقدم الخدمة غير متطابقة', 400);
                    }

                    // Overwrite price with database price
                    item.price = dbService.price;
                }
            }

            const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let totalDiscount = 0;
            let validatedPrizeId = null;
            let prizeProviderId = null; // Track provider-scoped prizes
            let isFreeDelivery = false; // Track free delivery prize separately

            if (userPrizeId) {
                const prize = await bookingRepo.getUnusedUserPrize(userPrizeId, userId, client);
                if (!prize) throw new AppError('الجائزة مستخدمة بالفعل أو منتهية الصلاحية', 400);
                validatedPrizeId = prize.id;
                prizeProviderId = prize.provider_id || null; // null = global, ID = provider-specific

                if (prize.prize_type === 'free_delivery') {
                    // Free delivery is handled separately — not a product discount
                    isFreeDelivery = true;
                } else {
                    // Calculate the correct discount base (provider-scoped or global)
                    let discountBase = totalPrice;
                    if (prizeProviderId) {
                        // Only discount items belonging to the prize's provider
                        const { decodeEntityId: decId } = require('../utils/obfuscate');
                        discountBase = items
                            .filter(i => {
                                const decodedPId = decId('provider', i.providerId) || i.providerId;
                                return String(decodedPId) === String(prizeProviderId);
                            })
                            .reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    }

                    if (prize.prize_type === 'discount_percent') {
                        totalDiscount += Math.round(discountBase * (prize.prize_value / 100) * 100) / 100;
                    } else {
                        // discount_flat: cap at the discount base to prevent over-discounting
                        totalDiscount += Math.min(prize.prize_value, discountBase);
                    }
                }
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
            const deliveryAddressStr = addressInfo ? [addressInfo.address, addressInfo.area, addressInfo.street, addressInfo.details].filter(Boolean).join(' - ') || 'N/A' : 'No Address';
            const summaryStr = addressInfo ? `الهاتف: ${addressInfo.phone} | العنوان: ${deliveryAddressStr}` : 'No Address';

            const parentId = await bookingRepo.createParentOrder(userId, finalPrice, totalDiscount, validatedPrizeId, summaryStr, encryptedAddress, client);

            const grouped = {};
            items.forEach(item => {
                const pId = decodeEntityId('provider', item.providerId) || item.providerId;
                if (!grouped[pId]) grouped[pId] = { providerName: item.providerName, items: [] };
                grouped[pId].items.push(item);
            });

            // Smart discount distribution: provider-scoped vs global
            let prizeTargetBookingIndex = 0; // Track which booking gets the prize link
            const groupEntries = Object.entries(grouped);
            const bookingPromises = groupEntries.map(([pId, group], index) => {
                const pSubtotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                let pDiscount = 0;
                if (totalDiscount > 0) {
                    if (prizeProviderId && !promoCode) {
                        // Provider-scoped prize: ALL discount goes to the matching provider only
                        if (String(pId) === String(prizeProviderId)) {
                            pDiscount = totalDiscount;
                            prizeTargetBookingIndex = index;
                        }
                    } else {
                        // Global prize or promo code: distribute proportionally with proper rounding
                        pDiscount = Math.round((pSubtotal / totalPrice) * totalDiscount * 100) / 100;
                    }
                }

                return bookingRepo.createBookingItem([
                    userId, pId, 'User', `Order #${parentId}`, group.providerName, Math.max(0, pSubtotal - pDiscount), pDiscount, summaryStr,
                    JSON.stringify(group.items), parentId, `BUNDLE-${parentId}`
                ], client);
            });
            
            const bookingIds = await Promise.all(bookingPromises);

            // Link the prize to the correct booking (the provider's booking, not always the first)
            if (validatedPrizeId) await bookingRepo.markPrizeAsUsed(bookingIds[prizeTargetBookingIndex], validatedPrizeId, client);

            // [HALAN SYNC]
            let halanOrderId = null;
            let trackingCode = null;
            if (addressInfo) {
                const orderNum = `HLN-${Date.now().toString(36).toUpperCase()}`;
                trackingCode = generateTrackingCode();
                const userRes = await client.query('SELECT name, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
                const user = userRes.rows[0] || {};
                const notes = isFreeDelivery ? 'توصيل مجاني (جائزة العجلة)' : null;
                const dResult = await client.query(`
                    INSERT INTO delivery_orders (order_number, customer_name, customer_phone, customer_id, pickup_address, delivery_address, status, source, order_type, tracking_code, delivery_fee, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
                `, [orderNum, addressInfo.name || user.name || 'Client', addressInfo.phone || user.phone || '', userId, Object.values(grouped).map(g => g.providerName).join(' | '), deliveryAddressStr, 'pending', 'qareeblak', 'app', trackingCode, 0, notes]);
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

            return { parentId, bookingIds, finalPrice, walletUsed: walletDeduction, trackingCode, providerIds: Object.keys(grouped) };
        });

        // Send tracking code notification asynchronously
        setImmediate(async () => {
            try {
                if (result.trackingCode && userId) {
                    const countRes = await db.query('SELECT COUNT(*) FROM parent_orders WHERE user_id = $1', [userId]);
                    const orderCount = Number(countRes.rows[0]?.count || 0);
                    const msg = `كود الاوردر رقم ${orderCount} هو ${result.trackingCode}`;
                    await createNotification(userId, msg, 'tracking_code', String(result.parentId), io);
                }

                // [NEW] Notify providers of the new order
                const providerIds = result.providerIds || [];
                for (const pId of providerIds) {
                    const providerUserId = await bookingRepo.getUserIdByProviderId(pId);
                    if (providerUserId) {
                        await createNotification(providerUserId, 'لديك طلب جديد!', 'new_order', String(result.parentId), io);
                    }
                }
            } catch (e) {
                logger.error(`Failed to send async notifications for checkout Parent #${result.parentId}:`, e.message);
            }
        });

        return result;
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

        // (REMOVED) Sync delivery order status when provider marks order ready
        // It is now handled centrally by parent-sync.js via the queue.

        const customerId = bookingInfo.user_id;
        // providerUserId is now returned directly from getBookingToUpdate JOIN — no extra DB call
        const providerUserId = bookingInfo.providerUserId;

        if (io) {
            const payload = { id, status, parentId: bookingInfo.parent_order_id };
            if (customerId) {
                io.to(`user-${customerId}`).emit('booking-updated', payload);
                
                const appointmentTypes = ['medical', 'maintenance', 'playground', 'playgrounds', 'car_service', 'home_service'];
                const isAppointment = appointmentTypes.includes(currentBooking.appointment_type);
                
                let msg = null;
                const providerName = currentBooking.provider_name || 'مقدم الخدمة';
                
                if (isAppointment) {
                    if (status === 'confirmed') msg = `تم قبول الموعد من قبل ${providerName} 📅`;
                    else if (status === 'completed') msg = `تم الانتهاء من الخدمة بواسطة ${providerName}، شكراً لك! ✨`;
                    else if (status === 'cancelled' || status === 'rejected') msg = `تم إلغاء الموعد من قبل ${providerName} ❌`;
                } else {
                    if (status === 'confirmed') msg = `تم قبول الأوردر وجاري التجهيز من قبل ${providerName} 🛒`;
                    else if (status === 'completed') msg = `تم الانتهاء من تجهيز طلبك بواسطة ${providerName}! 🛍️`;
                    else if (status === 'cancelled' || status === 'rejected') msg = `تم إلغاء الطلب من قبل ${providerName} ❌`;
                }

                if (msg) {
                    const { createNotification } = require('../routes/notifications');
                    createNotification(customerId, msg, 'order_status_update', String(id), io).catch(e => logger.warn(`Notification failed: ${e.message}`));
                }
            }
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
