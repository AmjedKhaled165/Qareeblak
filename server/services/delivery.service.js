const deliveryRepo = require('../repositories/delivery.repository');
const db = require('../db');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { generateTrackingCode } = require('../utils/generate-tracking-code');
const { createNotification } = require('../routes/notifications');
const { performAutoAssign } = require('../utils/driver-assignment');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const whatsappRoutes = require('../routes/whatsapp');

class DeliveryService {
    _emitOrderSync(io, orderId, { status, updates = {}, extraBooking = {} } = {}) {
        if (!io) return;

        const normalizedOrderId = Number(orderId);
        const payloadUpdates = { ...updates };
        if (status && !Object.prototype.hasOwnProperty.call(payloadUpdates, 'status')) {
            payloadUpdates.status = status;
        }

        io.emit('order-updated', {
            orderId: normalizedOrderId,
            updates: payloadUpdates,
            status: status || payloadUpdates.status
        });

        if (status) {
            io.emit('order-status-changed', { orderId: normalizedOrderId, status });
        }

        io.emit('booking-updated', {
            halanOrderId: normalizedOrderId,
            status: status || payloadUpdates.status,
            ...extraBooking
        });
    }

    async getOrders(reqUser, query) {
        const { status, courierId, supervisorId, search, source, page = 1, limit = 50 } = query;
        const offset = (page - 1) * limit;

        const result = await deliveryRepo.getOrders({
            role: reqUser.role || reqUser.type,
            userId: reqUser.id || reqUser.userId,
            status,
            courierId,
            supervisorId,
            search,
            source,
            limit,
            offset
        });

        const normalizedRole = String(reqUser.role || reqUser.type || '').toLowerCase();
        const isAdminLike = ['admin', 'owner', 'partner_owner'].includes(normalizedRole);

        if (isAdminLike && Array.isArray(result.records) && result.records.length > 0) {
            const requesterId = reqUser.id || reqUser.userId;
            const backfillCandidates = result.records.filter((o) => {
                const hasSupervisor = Number(o.supervisor_id || 0) > 0;
                const closed = ['delivered', 'cancelled'].includes(String(o.status || '').toLowerCase());
                return !hasSupervisor && !closed;
            }).slice(0, 10);

            // Asynchronously process backfill in parallel so we don't block the GET request
            setImmediate(async () => {
                await Promise.allSettled(backfillCandidates.map(order =>
                    performAutoAssign(order.id, requesterId, null, String(order.status || 'pending'))
                        .catch(e => logger.error(`[OrderBackfill] Failed auto-assign for order #${order.id}:`, e.message || e))
                ));
            });
        }

        return result;
    }

    async getCourierHistory(userId, role, period = 'today', explicitCourierId) {
        const normalizedRole = String(role || '').toLowerCase();
        const normalizedPeriod = ['today', 'week', 'month'].includes(period) ? period : 'today';

        let courierId = Number(userId);
        if (['admin', 'owner', 'partner_owner'].includes(normalizedRole) && explicitCourierId) {
            const parsed = Number(explicitCourierId);
            if (Number.isInteger(parsed) && parsed > 0) {
                courierId = parsed;
            }
        }

        return await deliveryRepo.getCourierHistory(courierId, normalizedPeriod);
    }

    _parseItems(rawItems) {
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

    async customerCancel(orderId, payload, io) {
        const currentOrder = await deliveryRepo.getOrderById(orderId);
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const blockedStatuses = new Set(['delivered', 'cancelled', 'picked_up', 'in_transit']);
        if (blockedStatuses.has(String(currentOrder.status || '').toLowerCase())) {
            throw new AppError('لا يمكن إلغاء الطلب بعد خروجه للتوصيل', 400);
        }

        const [updated] = await Promise.all([
            deliveryRepo.updateOrder(orderId, { status: 'cancelled' }),
            deliveryRepo.addHistory(orderId, 'cancelled', null, payload?.reason || 'تم إلغاء الطلب من العميل')
        ]);

        if (io) {
            this._emitOrderSync(io, orderId, { status: 'cancelled', updates: { status: 'cancelled' } });
            const linkedBookings = await deliveryRepo.getLinkedBookings(orderId);
            const parentIds = linkedBookings.filter(b => b.parent_order_id).map(b => b.parent_order_id);
            for (const b of linkedBookings) {
                io.emit('booking-updated', { id: b.id, status: 'cancelled', halanOrderId: Number(orderId) });
            }
            await Promise.all(parentIds.map(pid => syncParentOrderStatus(pid, io).catch(e => logger.error(`syncParentOrderStatus #${pid} failed:`, e.message))));
        }

        return updated;
    }

    async customerRemoveItem(orderId, itemIndex, bookingId, quantityToRemove, io) {
        const currentOrder = await deliveryRepo.getOrderById(orderId);
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const blockedStatuses = new Set(['ready_for_pickup', 'completed', 'delivered', 'cancelled', 'picked_up', 'in_transit']);
        if (blockedStatuses.has(String(currentOrder.status || '').toLowerCase())) {
            throw new AppError('لا يمكن التعديل، الطلب قيد التجهيز أو تم تسليمه', 400);
        }

        const elapsedSeconds = (Date.now() - new Date(currentOrder.created_at).getTime()) / 1000;
        if (elapsedSeconds > 300) {
            throw new AppError('لقد تجاوزت مهلة التعديل المسموحة (5 دقائق)', 400);
        }

        if (bookingId) {
            const bookingRes = await db.query('SELECT items FROM bookings WHERE id = $1', [bookingId]);
            if (bookingRes.rows.length > 0) {
                const bookingItems = this._parseItems(bookingRes.rows[0].items);
                if (itemIndex >= 0 && itemIndex < bookingItems.length) {
                    const itemToRemove = bookingItems[itemIndex];
                    let logMsg = '';
                    if (quantityToRemove && quantityToRemove < (itemToRemove.quantity || 1)) {
                        itemToRemove.quantity -= quantityToRemove;
                        logMsg = `قام العميل بتقليل كمية منتج (${itemToRemove.name}) بـ ${quantityToRemove}`;
                    } else {
                        const removedItem = bookingItems.splice(itemIndex, 1)[0];
                        logMsg = `قام العميل بحذف منتج (${removedItem?.name}) من طلب المتجر`;
                    }
                    
                    const newBookingPrice = bookingItems.reduce((sum, i) => sum + (parseFloat(i.price || i.unit_price || 0) * (parseFloat(i.quantity) || 1)), 0);
                    await db.query('UPDATE bookings SET items = $1, price = $2, updated_at = NOW() WHERE id = $3', [JSON.stringify(bookingItems), newBookingPrice, bookingId]);
                    
                    // Sync parent order items
                    const allBookingsRes = await db.query('SELECT items FROM bookings WHERE CAST(halan_order_id AS TEXT) = $1', [String(orderId)]);
                    const allItems = allBookingsRes.rows.flatMap(r => this._parseItems(r.items));
                    await deliveryRepo.updateOrder(orderId, { items: JSON.stringify(allItems) });
                    
                    deliveryRepo.addHistory(orderId, currentOrder.status || 'pending', null, logMsg);
                    if (io) this._emitOrderSync(io, orderId, { updates: { items: allItems }, extraBooking: { items: bookingItems } });
                    return await deliveryRepo.getOrderById(orderId); // return updated order
                }
            }
        }

        const items = this._parseItems(currentOrder.items);
        if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) {
            throw new AppError('العنصر المطلوب غير موجود', 400);
        }

        const targetItem = items[itemIndex];
        let logMsg = '';
        if (quantityToRemove && quantityToRemove < (targetItem.quantity || 1)) {
            targetItem.quantity -= quantityToRemove;
            logMsg = `قام العميل بتقليل كمية منتج (${targetItem.name}) بـ ${quantityToRemove}`;
        } else {
            items.splice(itemIndex, 1);
            logMsg = `قام العميل بحذف منتج من الطلب (index: ${itemIndex})`;
        }

        const [updated] = await Promise.all([
            deliveryRepo.updateOrder(orderId, { items: JSON.stringify(items) }),
            deliveryRepo.addHistory(orderId, currentOrder.status || 'pending', null, logMsg)
        ]);

        if (io) {
            this._emitOrderSync(io, orderId, { updates: { items }, extraBooking: { items } });
        }

        return updated;
    }

    _parseItems(rawItems) {
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

    async customerAddItemsBulk(orderId, items, providerId, io) {
        const currentOrder = await deliveryRepo.getOrderById(orderId);
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const blockedStatuses = new Set(['delivered', 'cancelled', 'picked_up', 'in_transit']);
        if (blockedStatuses.has(String(currentOrder.status || '').toLowerCase())) {
            throw new AppError('لا يمكن الإضافة، تم خروج الطلب للتوصيل', 400);
        }

        const incoming = Array.isArray(items) ? items : [];
        if (incoming.length === 0) {
            throw new AppError('لا توجد منتجات لإضافتها', 400);
        }

        // [SECURITY PATCH] Zero-Trust Price Verification
        const verifiableIds = Array.from(new Set(
            incoming.filter(i => i.id && !isNaN(Number(i.id))).map(i => Number(i.id))
        ));

        let serverPriceMap = new Map();
        if (verifiableIds.length > 0) {
            const pricesResult = await db.query('SELECT id, price FROM services WHERE id = ANY($1)', [verifiableIds]);
            serverPriceMap = new Map(pricesResult.rows.map(r => [Number(r.id), Number(r.price)]));
        }

        const normalized = incoming
            .map((item) => {
                const itemId = item.id && !isNaN(Number(item.id)) ? Number(item.id) : null;
                if (!itemId) {
                    // Reject items without a verifiable service ID
                    return null;
                }
                const serverPrice = serverPriceMap.get(itemId);
                if (serverPrice === undefined) {
                    // Item ID not found in services table — reject to prevent price tampering
                    return null;
                }
                return {
                    id: itemId,
                    name: String(item?.name || item?.product_name || '').trim(),
                    quantity: Math.max(1, Number(item?.quantity || 1)),
                    price: serverPrice,
                    notes: item?.notes ? String(item.notes) : undefined,
                    providerId: providerId ? Number(providerId) : (item?.providerId ? Number(item.providerId) : undefined),
                    providerName: item?.providerName ? String(item.providerName) : undefined
                };
            })
            .filter((item) => item !== null && item.name.length > 0);

        if (normalized.length === 0) {
            throw new AppError('بيانات المنتجات غير صالحة', 400);
        }

        if (providerId) {
            const bookingResult = await db.query('SELECT id, items FROM bookings WHERE CAST(halan_order_id AS TEXT) = $1 AND provider_id = $2', [String(orderId), providerId]);
            if (bookingResult.rows.length > 0) {
                const booking = bookingResult.rows[0];
                const bookingItems = this._parseItems(booking.items);
                const mergedBookingItems = [...bookingItems, ...normalized];
                const newPrice = mergedBookingItems.reduce((sum, i) => sum + (parseFloat(i.price || i.unit_price || 0) * (parseFloat(i.quantity) || 1)), 0);
                await db.query('UPDATE bookings SET items = $1, price = $2, updated_at = NOW() WHERE id = $3', [JSON.stringify(mergedBookingItems), newPrice, booking.id]);
            } else {
                const parentResult = await db.query('SELECT MAX(parent_order_id) as parent_id FROM bookings WHERE CAST(halan_order_id AS TEXT) = $1', [String(orderId)]);
                const parentId = parentResult.rows[0]?.parent_id || null;
                const price = normalized.reduce((sum, i) => sum + (parseFloat(i.price || i.unit_price || 0) * (parseFloat(i.quantity) || 1)), 0);
                
                let providerName = normalized[0]?.providerName;
                if (providerId) {
                    try {
                        const pRes = await db.query('SELECT name FROM providers WHERE id = $1 LIMIT 1', [providerId]);
                        if (pRes.rows.length > 0) {
                            providerName = pRes.rows[0].name;
                        } else {
                            const uRes = await db.query('SELECT name FROM users WHERE id = $1 LIMIT 1', [providerId]);
                            if (uRes.rows.length > 0) {
                                providerName = uRes.rows[0].name;
                            }
                        }
                    } catch (err) {
                        console.error('[customerAddItemsBulk] Error fetching provider name:', err.message);
                    }
                }
                providerName = providerName || 'متجر غير معروف';
                
                const userId = currentOrder.customer_id || null;
                const userName = currentOrder.customer_name || 'عميل';
                const details = `الهاتف: ${currentOrder.customer_phone || ''} | العنوان: ${currentOrder.delivery_address || ''}`;
                
                await db.query(`
                    INSERT INTO bookings 
                    (user_id, provider_id, user_name, service_name, provider_name, price, details, items, parent_order_id, halan_order_id, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    userId, providerId, userName, `إضافة منتجات (${normalized.length} أصناف)`, providerName, price, details, JSON.stringify(normalized), parentId, orderId, 'pending'
                ]);
            }
        }

        const currentItems = this._parseItems(currentOrder.items);
        const merged = [...currentItems, ...normalized];

        const [updated] = await Promise.all([
            deliveryRepo.updateOrder(orderId, { items: JSON.stringify(merged) }),
            deliveryRepo.addHistory(orderId, currentOrder.status || 'pending', null, `أضاف العميل ${normalized.length} منتج/منتجات للطلب`)
        ]);

        if (io) {
            this._emitOrderSync(io, orderId, { updates: { items: merged }, extraBooking: { items: merged } });
        }

        return { order: updated, items: merged };
    }

    async _sendTrackingCodeNotification(userId, trackingCode, orderId, io) {
        try {
            const countRes = await db.query('SELECT COUNT(*) FROM parent_orders WHERE user_id = $1', [userId]);
            const orderCount = Number(countRes.rows[0]?.count || 0);
            const msg = `كود الاوردر رقم ${orderCount} هو ${trackingCode}`;
            await createNotification(userId, msg, 'tracking_code', String(orderId), io);
        } catch (e) {
            logger.error(`Failed to send tracking code notification for user #${userId}:`, e.message);
        }
    }

    async createOrder(userId, role, orderData, io) {
        const {
            customerName, customerPhone, pickupAddress, deliveryAddress,
            pickupLat, pickupLng, deliveryLat, deliveryLng,
            courierId, autoAssign, notes, deliveryFee,
            items, products, source = 'manual', orderType
        } = orderData;

        const finalItems = items || products || [];
        const effectiveOrderType = orderType || (source === 'qareeblak' ? 'app' : 'manual');
        const effectiveDeliveryAddress = deliveryAddress || 'عنوان يدوي';

        const creator = await deliveryRepo.getUserInfo(userId);
        const effectiveSource = (source === 'manual' || !source)
            ? (creator?.name ? `طلب يدوي بواسطة ${creator.name}` : 'manual')
            : source;

        const trackingCode = generateTrackingCode();

        const itemsWithProvider = finalItems.filter(p => p.providerId);
        const isSplitMode = itemsWithProvider.length > 0;

        let order;
        if (isSplitMode) {
            order = await this._createSplitOrder(userId, role, {
                customerName, customerPhone, pickupAddress, effectiveDeliveryAddress,
                pickupLat, pickupLng, deliveryLat, deliveryLng,
                courierId, notes, deliveryFee, finalItems, itemsWithProvider,
                effectiveSource, effectiveOrderType, trackingCode
            });
        } else {
            order = await this._createNormalOrder(userId, role, {
                customerName, customerPhone, pickupAddress, effectiveDeliveryAddress,
                pickupLat, pickupLng, deliveryLat, deliveryLng,
                courierId, notes, deliveryFee, finalItems,
                effectiveSource, effectiveOrderType, trackingCode
            });
        }

        setImmediate(() => this._sendTrackingCodeNotification(userId, trackingCode, order.id, io));
        return order;
    }

    async _createNormalOrder(userId, role, data) {
        const orderNumber = `HLN-${Date.now().toString(36).toUpperCase()}`;
        const courierId = (role === 'courier' && !data.courierId) ? userId : (data.courierId || null);

        const order = await deliveryRepo.createDeliveryOrder({
            orderNumber, ...data, courierId, status: 'pending', items: data.finalItems, source: data.effectiveSource,
            trackingCode: data.trackingCode
        });

        try {
            await performAutoAssign(order.id, userId, null); // io handled in controller
        } catch (e) { logger.error('Auto-assign failed', e); }

        return await deliveryRepo.getOrderById(order.id);
    }

    async _createSplitOrder(userId, role, data) {
        const client = await deliveryRepo.beginTransaction();
        try {
            const orderNumber = `HLN-${Date.now().toString(36).toUpperCase()}`;
            const totalPrice = data.finalItems.reduce((sum, p) => sum + (parseFloat(p.price || p.unit_price || 0) * (parseFloat(p.quantity) || 1)), 0);

            const parentId = await deliveryRepo.createParentOrder({
                userId, totalPrice,
                details: `عميل: ${data.customerName} | هاتف: ${data.customerPhone} | عنوان: ${data.effectiveDeliveryAddress}`,
                addressInfo: JSON.stringify({
                    customerName: data.customerName,
                    customerPhone: data.customerPhone,
                    deliveryAddress: data.effectiveDeliveryAddress,
                    notes: data.notes
                })
            }, client);

            const courierId = (role === 'courier' && !data.courierId) ? userId : (data.courierId || null);

            const deliveryOrder = await deliveryRepo.createDeliveryOrder({
                orderNumber, ...data, courierId, status: 'pending', items: data.finalItems, source: data.effectiveSource,
                trackingCode: data.trackingCode
            }, client);

            const grouped = {};
            data.itemsWithProvider.forEach(item => {
                if (!grouped[item.providerId]) grouped[item.providerId] = { name: item.providerName, items: [] };
                grouped[item.providerId].items.push(item);
            });

            await Promise.all(Object.entries(grouped).map(([providerId, group]) => {
                const price = group.items.reduce((sum, i) => sum + (parseFloat(i.price || i.unit_price || 0) * (parseFloat(i.quantity) || 1)), 0);
                return deliveryRepo.createSubBooking({
                    userId, providerId, userName: data.customerName,
                    serviceName: `طلب يدوي (${group.items.length} أصناف)`,
                    providerName: group.name, price,
                    details: `الهاتف: ${data.customerPhone} | العنوان: ${data.effectiveDeliveryAddress}`,
                    items: group.items, parentId, deliveryOrderId: deliveryOrder.id
                }, client);
            }));

            await deliveryRepo.commitTransaction(client);

            try {
                await performAutoAssign(deliveryOrder.id, userId, null);
            } catch (e) { logger.error('Auto-assign failed in split mode', e); }

            return await deliveryRepo.getOrderById(deliveryOrder.id);
        } catch (error) {
            await deliveryRepo.rollbackTransaction(client);
            throw error;
        }
    }

    async updateOrder(id, userId, role, data, io) {
        const currentOrder = await deliveryRepo.getOrderByIdSecure(id, { userId, role });
        if (!currentOrder) throw new AppError('Order not found or unauthorized', 404);

        const normalizedRole = String(role || '').toLowerCase();
        const isCourier = ['courier', 'partner_courier'].includes(normalizedRole);
        const nextStatus = String(data?.status || '').trim().toLowerCase();
        const pickupTransitions = ['picked_up', 'in_transit'];
        if (isCourier && pickupTransitions.includes(nextStatus)) {
            const allReady = await deliveryRepo.areAllLinkedBookingsReady(id);
            if (!allReady) {
                throw new AppError('لا يمكن الاستلام قبل أن يقوم كل مقدم خدمة بتجهيز طلبه', 400);
            }
        }
        const deliverTransitions = ['delivered', 'تم التوصيل'];
        if (isCourier && deliverTransitions.includes(nextStatus)) {
            const hasIncomingFee = Object.prototype.hasOwnProperty.call(data || {}, 'delivery_fee');
            const incomingFee = hasIncomingFee ? Number(data.delivery_fee) : NaN;
            const currentFee = Number(currentOrder?.delivery_fee || 0);
            const effectiveFee = Number.isFinite(incomingFee) ? incomingFee : currentFee;
            if (!(effectiveFee > 0)) {
                throw new AppError('لا يمكن تحديد تم التوصيل قبل تسجيل سعر التوصيل وحفظه', 400);
            }
        }

        const updated = await deliveryRepo.updateOrder(id, data);

        if (!updated) {
            throw new AppError('لا توجد بيانات قابلة للتحديث', 400);
        }

        if (io) {
            this._emitOrderSync(io, id, { status: data.status, updates: data });

            if (Object.prototype.hasOwnProperty.call(data, 'status')) {

                const linkedBookings = await deliveryRepo.getLinkedBookings(id);
                const parentIds = linkedBookings.filter(b => b.parent_order_id).map(b => b.parent_order_id);
                for (const b of linkedBookings) {
                    io.emit('booking-updated', { id: b.id, status: data.status, halanOrderId: Number(id) });
                }
                await Promise.all(parentIds.map(pid => syncParentOrderStatus(pid, io).catch(e => logger.error(`syncParentOrderStatus #${pid} failed:`, e.message))));
            }
        }

        const normalizedStatus = String(data?.status || '').trim().toLowerCase();
        const isDelivered = ['delivered', 'تم التوصيل'].includes(normalizedStatus);
        if (isDelivered && typeof whatsappRoutes.sendOrderInvoice === 'function') {
            whatsappRoutes.sendOrderInvoice(id)
                .then(invoiceResult => {
                    if (invoiceResult?.success) {
                        logger.info(`WhatsApp invoice sent successfully for delivered order #${id} (updateOrder)`);
                    } else {
                        logger.error(`WhatsApp invoice failed for delivered order #${id} (updateOrder):`, invoiceResult?.error || 'unknown error');
                    }
                })
                .catch(err => {
                    logger.error(`Failed to send WhatsApp invoice for delivered order #${id} from updateOrder:`, err.message || err);
                });
        }

        return updated;
    }

    async updateStatus(id, userId, role, statusData, io) {
        const { status, notes, latitude, longitude } = statusData;

        // Secure access check
        const currentOrder = await deliveryRepo.getOrderByIdSecure(id, { userId, role });
        if (!currentOrder) throw new AppError('Order not found or unauthorized', 404);

        const normalizedRole = String(role || '').toLowerCase();
        const isCourier = ['courier', 'partner_courier'].includes(normalizedRole);
        const nextStatus = String(status || '').trim().toLowerCase();
        const pickupTransitions = ['picked_up', 'in_transit'];
        if (isCourier && pickupTransitions.includes(nextStatus)) {
            const allReady = await deliveryRepo.areAllLinkedBookingsReady(id);
            if (!allReady) {
                throw new AppError('لا يمكن الاستلام قبل أن يقوم كل مقدم خدمة بتجهيز طلبه', 400);
            }
        }
        const deliverTransitions = ['delivered', 'تم التوصيل'];
        if (isCourier && deliverTransitions.includes(nextStatus)) {
            const currentFee = Number(currentOrder?.delivery_fee || 0);
            if (!(currentFee > 0)) {
                throw new AppError('لا يمكن تحديد تم التوصيل قبل تسجيل سعر التوصيل وحفظه', 400);
            }
        }

        await Promise.all([
            deliveryRepo.updateOrder(id, { status }),
            deliveryRepo.addHistory(id, status, userId, notes || `تم تحديث الحالة إلى: ${status}`, latitude, longitude)
        ]);

        // Notify via Sockets
        if (io) {
            this._emitOrderSync(io, id, { status, updates: { status } });
            const bookings = await deliveryRepo.getLinkedBookings(id);
            const parentIds = bookings.filter(b => b.parent_order_id).map(b => b.parent_order_id);
            for (const b of bookings) {
                io.emit('booking-updated', { id: b.id, status });
            }
            await Promise.all(parentIds.map(pid => syncParentOrderStatus(pid, io).catch(e => logger.error(`syncParentOrderStatus #${pid} failed:`, e.message))));
        }

        // Auto-send WhatsApp invoice once courier marks order as delivered
        const normalizedStatus = String(status || '').trim().toLowerCase();
        const isDelivered = ['delivered', 'تم التوصيل'].includes(normalizedStatus);
        if (isDelivered && typeof whatsappRoutes.sendOrderInvoice === 'function') {
            whatsappRoutes.sendOrderInvoice(id)
                .then(invoiceResult => {
                    if (invoiceResult?.success) {
                        logger.info(`WhatsApp invoice sent successfully for delivered order #${id} (updateStatus)`);
                    } else {
                        logger.error(`WhatsApp invoice failed for delivered order #${id} (updateStatus):`, invoiceResult?.error || 'unknown error');
                    }
                })
                .catch(err => {
                    logger.error(`Failed to send WhatsApp invoice for delivered order #${id}:`, err.message || err);
                });
        }

        return { success: true };
    }

    async assignCourier(orderIdParam, userId, role, payload, io) {
        const { decodeEntityId } = require('../utils/obfuscate');
        const orderId = decodeEntityId('order', orderIdParam) || orderIdParam;

        const normalizedRole = String(role || '').toLowerCase();
        const isOwner = normalizedRole === 'owner' || normalizedRole === 'partner_owner';
        const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'partner_supervisor';

        if (!isOwner && !isSupervisor) {
            throw new AppError('غير مصرح لك بتعيين المندوب', 403);
        }

        const rawCourierId = payload.courierId || payload.courier_id;
        const decodedCourierId = decodeEntityId('user', rawCourierId) || rawCourierId;
        const courierId = Number(decodedCourierId);
        
        if (!Number.isInteger(courierId) || courierId <= 0) {
            throw new AppError('معرف المندوب غير صالح', 400);
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const orderRes = await client.query(
                `SELECT id, supervisor_id, courier_id, status FROM delivery_orders WHERE id = $1 FOR UPDATE`,
                [orderId]
            );
            if (!orderRes.rows.length) {
                throw new AppError('الطلب غير موجود', 404);
            }

            const order = orderRes.rows[0];
            const blockedStatuses = ['delivered', 'cancelled', 'تم التوصيل'];
            if (blockedStatuses.includes(String(order.status || '').toLowerCase())) {
                throw new AppError('لا يمكن تعيين مندوب لطلب منتهي أو ملغي', 400);
            }
            if (Number(order.courier_id) === courierId) {
                await client.query('COMMIT');
                return { success: true, message: 'هذا الطلب معين بالفعل لهذا المندوب' };
            }
            if (isSupervisor && Number(order.supervisor_id) !== Number(userId)) {
                throw new AppError('لا يمكنك تعيين مندوب لطلب خارج مسؤوليتك', 403);
            }

            const courierRes = await client.query(
                `SELECT id, name, user_type, is_available
                 FROM users
                 WHERE id = $1
                 AND COALESCE(user_type, '') IN ('courier', 'partner_courier')`,
                [courierId]
            );
            if (!courierRes.rows.length) {
                throw new AppError('المندوب غير موجود', 404);
            }

            if (isSupervisor) {
                const relRes = await client.query(
                    `SELECT 1 FROM courier_supervisors WHERE courier_id = $1 AND supervisor_id = $2 LIMIT 1`,
                    [courierId, userId]
                );
                if (!relRes.rows.length) {
                    throw new AppError('هذا المندوب غير مرتبط بهذا المسؤول', 403);
                }
            }

            const nextStatus = ['pending', 'ready_for_pickup'].includes(String(order.status || '')) ? 'assigned' : order.status;

            await client.query(
                `UPDATE delivery_orders
                 SET courier_id = $1,
                     status = $2
                 WHERE id = $3`,
                [courierId, nextStatus, orderId]
            );

            await client.query(
                `INSERT INTO order_history (order_id, status, changed_by, notes)
                 VALUES ($1, $2, $3, $4)`,
                [
                    orderId,
                    'assigned',
                    userId || null,
                    payload.notes || `تم التعيين اليدوي للمندوب #${courierId}`
                ]
            );

            const updatedRes = await client.query(
                `SELECT o.*, c.name AS courier_name, s.name AS supervisor_name
                 FROM delivery_orders o
                 LEFT JOIN users c ON o.courier_id = c.id
                 LEFT JOIN users s ON o.supervisor_id = s.id
                 WHERE o.id = $1`,
                [orderId]
            );

            await client.query('COMMIT');

            if (io) {
                io.emit('order-assigned', { orderId: Number(orderId), courierId });
                this._emitOrderSync(io, orderId, {
                    status: nextStatus,
                    updates: { status: nextStatus, courier_id: courierId },
                    extraBooking: { courierId }
                });
            }

            return updatedRes.rows[0] || null;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async updateCourierPricing(orderId, userId, role, payload, io) {
        const normalizedRole = String(role || '').toLowerCase();
        const isCourier = normalizedRole === 'courier' || normalizedRole === 'partner_courier';
        const isAdminLike = ['admin', 'owner', 'partner_owner', 'supervisor', 'partner_supervisor'].includes(normalizedRole);

        if (!isCourier && !isAdminLike) {
            throw new AppError('غير مصرح لك بتعديل رسوم التوصيل', 403);
        }

        const currentOrder = await deliveryRepo.getOrderByIdSecure(orderId, { userId, role });
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود أو غير مصرح لك', 404);
        }

        if (isCourier && Number(currentOrder.courier_id || 0) !== Number(userId)) {
            throw new AppError('لا يمكنك تعديل طلب غير مسند إليك', 403);
        }

        const deliveryFee = Number(payload.deliveryFee);
        const notes = payload.notes == null ? null : String(payload.notes);
        if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
            throw new AppError('رسوم التوصيل غير صالحة', 400);
        }

        const updates = {
            delivery_fee: deliveryFee,
            notes
        };

        const before = {
            delivery_fee: Number(currentOrder.delivery_fee || 0),
            notes: currentOrder.notes || null
        };

        const after = {
            delivery_fee: deliveryFee,
            notes
        };

        const updated = await deliveryRepo.updateCourierPricing(orderId, updates, {
            changedBy: userId,
            before,
            after
        });

        if (io) {
            this._emitOrderSync(io, orderId, {
                updates: {
                    delivery_fee: deliveryFee,
                    deliveryFee,
                    notes,
                    is_modified_by_courier: true
                },
                extraBooking: {
                    deliveryFee,
                    notes
                }
            });
        }

        return updated;
    }

    async publishOrder(orderId, userId, role, io) {
        const currentOrder = await deliveryRepo.getOrderByIdSecure(orderId, { userId, role });
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود أو غير مصرح لك', 404);
        }

        const currentStatus = String(currentOrder.status || '').toLowerCase();
        const targetStatus = ['pending', 'assigned'].includes(currentStatus)
            ? 'ready_for_pickup'
            : currentOrder.status;

        const updated = await deliveryRepo.updateOrder(orderId, { status: targetStatus });

        if (io) {
            io.emit('order-published', { orderId: Number(orderId) });
            this._emitOrderSync(io, orderId, { status: targetStatus, updates: { status: targetStatus } });
        }

        return updated;
    }

    async updateOrderMeta(orderId, userId, role, payload, io) {
        const normalizedRole = String(role || '').toLowerCase();
        const isOwner = normalizedRole === 'owner' || normalizedRole === 'partner_owner';
        if (!isOwner) {
            throw new AppError('غير مصرح لك بتعديل بيانات الطلب', 403);
        }

        if (Object.prototype.hasOwnProperty.call(payload, 'supervisor_id')) {
            throw new AppError('تحديد المسؤول يتم تلقائيا ولا يمكن تعديله يدويا', 400);
        }

        const fields = [];
        const values = [];

        if (Object.prototype.hasOwnProperty.call(payload, 'source')) {
            values.push(payload.source);
            fields.push(`source = $${values.length}`);
        }

        if (!fields.length) {
            throw new AppError('لا توجد بيانات قابلة للتحديث', 400);
        }

        values.push(orderId);
        const updatedRes = await db.query(
            `UPDATE delivery_orders
             SET ${fields.join(', ')}
             WHERE id = $${values.length}
             RETURNING *`,
            values
        );

        if (!updatedRes.rows.length) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const orderRes = await db.query(
            `SELECT o.*, c.name AS courier_name, s.name AS supervisor_name
             FROM delivery_orders o
             LEFT JOIN users c ON o.courier_id = c.id
             LEFT JOIN users s ON o.supervisor_id = s.id
             WHERE o.id = $1`,
            [orderId]
        );

        if (io) {
            this._emitOrderSync(io, orderId, { updates: payload || {} });
        }

        return orderRes.rows[0] || updatedRes.rows[0];
    }
}

module.exports = new DeliveryService();
