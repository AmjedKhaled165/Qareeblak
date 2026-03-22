const deliveryRepo = require('../repositories/delivery.repository');
const db = require('../db');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
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

        return await deliveryRepo.getOrders({
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

        const updated = await deliveryRepo.updateOrder(orderId, { status: 'cancelled' });
        await deliveryRepo.addHistory(orderId, 'cancelled', null, payload?.reason || 'تم إلغاء الطلب من العميل');

        if (io) {
            this._emitOrderSync(io, orderId, { status: 'cancelled', updates: { status: 'cancelled' } });
            const linkedBookings = await deliveryRepo.getLinkedBookings(orderId);
            for (const b of linkedBookings) {
                io.emit('booking-updated', { id: b.id, status: 'cancelled', halanOrderId: Number(orderId) });
                if (b.parent_order_id) {
                    await syncParentOrderStatus(b.parent_order_id, io);
                }
            }
        }

        return updated;
    }

    async customerRemoveItem(orderId, itemIndex, io) {
        const currentOrder = await deliveryRepo.getOrderById(orderId);
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const items = this._parseItems(currentOrder.items);
        if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= items.length) {
            throw new AppError('العنصر المطلوب غير موجود', 400);
        }

        items.splice(itemIndex, 1);
        const updated = await deliveryRepo.updateOrder(orderId, { items });
        await deliveryRepo.addHistory(orderId, currentOrder.status || 'pending', null, `قام العميل بحذف منتج من الطلب (index: ${itemIndex})`);

        if (io) {
            this._emitOrderSync(io, orderId, { updates: { items }, extraBooking: { items } });
        }

        return updated;
    }

    async customerAddItemsBulk(orderId, items, providerId, io) {
        const currentOrder = await deliveryRepo.getOrderById(orderId);
        if (!currentOrder) {
            throw new AppError('الطلب غير موجود', 404);
        }

        const incoming = Array.isArray(items) ? items : [];
        if (incoming.length === 0) {
            throw new AppError('لا توجد منتجات لإضافتها', 400);
        }

        const normalized = incoming
            .map((item) => ({
                name: String(item?.name || item?.product_name || '').trim(),
                quantity: Math.max(1, Number(item?.quantity || 1)),
                price: Math.max(0, Number(item?.price || item?.unit_price || 0)),
                notes: item?.notes ? String(item.notes) : undefined,
                providerId: providerId ? Number(providerId) : (item?.providerId ? Number(item.providerId) : undefined),
                providerName: item?.providerName ? String(item.providerName) : undefined
            }))
            .filter((item) => item.name.length > 0);

        if (normalized.length === 0) {
            throw new AppError('بيانات المنتجات غير صالحة', 400);
        }

        const currentItems = this._parseItems(currentOrder.items);
        const merged = [...currentItems, ...normalized];

        const updated = await deliveryRepo.updateOrder(orderId, { items: merged });
        await deliveryRepo.addHistory(orderId, currentOrder.status || 'pending', null, `أضاف العميل ${normalized.length} منتج/منتجات للطلب`);

        if (io) {
            this._emitOrderSync(io, orderId, { updates: { items: merged }, extraBooking: { items: merged } });
        }

        return { order: updated, items: merged };
    }

    async createOrder(userId, role, orderData) {
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

        const itemsWithProvider = finalItems.filter(p => p.providerId);
        const isSplitMode = itemsWithProvider.length > 0;

        if (isSplitMode) {
            return await this._createSplitOrder(userId, role, {
                customerName, customerPhone, pickupAddress, effectiveDeliveryAddress,
                pickupLat, pickupLng, deliveryLat, deliveryLng,
                courierId, notes, deliveryFee, finalItems, itemsWithProvider,
                effectiveSource, effectiveOrderType
            });
        } else {
            return await this._createNormalOrder(userId, role, {
                customerName, customerPhone, pickupAddress, effectiveDeliveryAddress,
                pickupLat, pickupLng, deliveryLat, deliveryLng,
                courierId, notes, deliveryFee, finalItems,
                effectiveSource, effectiveOrderType
            });
        }
    }

    async _createNormalOrder(userId, role, data) {
        const orderNumber = `HLN-${Date.now().toString(36).toUpperCase()}`;
        const courierId = (role === 'courier' && !data.courierId) ? userId : (data.courierId || null);

        const order = await deliveryRepo.createDeliveryOrder({
            orderNumber, ...data, courierId, status: 'pending', items: data.finalItems, source: data.effectiveSource
        });

        if (!courierId && data.effectiveOrderType === 'app') {
            try {
                await performAutoAssign(order.id, userId, null); // io handled in controller
            } catch (e) { logger.error('Auto-assign failed', e); }
        }

        return await deliveryRepo.getOrderById(order.id);
    }

    async _createSplitOrder(userId, role, data) {
        const client = await deliveryRepo.beginTransaction();
        try {
            const orderNumber = `HLN-${Date.now().toString(36).toUpperCase()}`;
            const totalPrice = data.finalItems.reduce((sum, p) => sum + (parseFloat(p.price || 0) * (p.quantity || 1)), 0);

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
                orderNumber, ...data, courierId, status: 'pending', items: data.finalItems, source: data.effectiveSource
            }, client);

            const grouped = {};
            data.itemsWithProvider.forEach(item => {
                if (!grouped[item.providerId]) grouped[item.providerId] = { name: item.providerName, items: [] };
                grouped[item.providerId].items.push(item);
            });

            for (const [providerId, group] of Object.entries(grouped)) {
                const price = group.items.reduce((sum, i) => sum + (parseFloat(i.price || 0) * (i.quantity || 1)), 0);
                await deliveryRepo.createSubBooking({
                    userId, providerId, userName: data.customerName,
                    serviceName: `طلب يدوي (${group.items.length} أصناف)`,
                    providerName: group.name, price,
                    details: `الهاتف: ${data.customerPhone} | العنوان: ${data.effectiveDeliveryAddress}`,
                    items: group.items, parentId, deliveryOrderId: deliveryOrder.id
                }, client);
            }

            await deliveryRepo.commitTransaction(client);

            if (!courierId) {
                try {
                    await performAutoAssign(deliveryOrder.id, userId, null);
                } catch (e) { logger.error('Auto-assign failed in split mode', e); }
            }

            return await deliveryRepo.getOrderById(deliveryOrder.id);
        } catch (error) {
            await deliveryRepo.rollbackTransaction(client);
            throw error;
        }
    }

    async updateOrder(id, userId, role, data, io) {
        const currentOrder = await deliveryRepo.getOrderByIdSecure(id, { userId, role });
        if (!currentOrder) throw new AppError('Order not found or unauthorized', 404);

        const updated = await deliveryRepo.updateOrder(id, data);

        if (!updated) {
            throw new AppError('لا توجد بيانات قابلة للتحديث', 400);
        }

        if (io) {
            this._emitOrderSync(io, id, { status: data.status, updates: data });

            if (Object.prototype.hasOwnProperty.call(data, 'status')) {

                const linkedBookings = await deliveryRepo.getLinkedBookings(id);
                for (const b of linkedBookings) {
                    io.emit('booking-updated', { id: b.id, status: data.status, halanOrderId: Number(id) });
                    if (b.parent_order_id) {
                        await syncParentOrderStatus(b.parent_order_id, io);
                    }
                }
            }
        }

        const normalizedStatus = String(data?.status || '').trim().toLowerCase();
        const isDelivered = ['delivered', 'تم التوصيل'].includes(normalizedStatus);
        if (isDelivered && typeof whatsappRoutes.sendOrderInvoice === 'function') {
            try {
                const invoiceResult = await whatsappRoutes.sendOrderInvoice(id);
                if (invoiceResult?.success) {
                    logger.info(`WhatsApp invoice sent successfully for delivered order #${id} (updateOrder)`);
                } else {
                    logger.error(`WhatsApp invoice failed for delivered order #${id} (updateOrder):`, invoiceResult?.error || 'unknown error');
                }
            } catch (err) {
                logger.error(`Failed to send WhatsApp invoice for delivered order #${id} from updateOrder:`, err.message || err);
            }
        }

        return updated;
    }

    async updateStatus(id, userId, role, statusData, io) {
        const { status, notes, latitude, longitude } = statusData;

        // Secure access check
        const currentOrder = await deliveryRepo.getOrderByIdSecure(id, { userId, role });
        if (!currentOrder) throw new AppError('Order not found or unauthorized', 404);

        await deliveryRepo.updateOrder(id, { status });
        await deliveryRepo.addHistory(id, status, userId, notes || `تم تحديث الحالة إلى: ${status}`, latitude, longitude);

        // Notify via Sockets
        if (io) {
            this._emitOrderSync(io, id, { status, updates: { status } });
            const bookings = await deliveryRepo.getLinkedBookings(id);
            for (const b of bookings) {
                io.emit('booking-updated', { id: b.id, status });
                if (b.parent_order_id) await syncParentOrderStatus(b.parent_order_id, io);
            }
        }

        // Auto-send WhatsApp invoice once courier marks order as delivered
        const normalizedStatus = String(status || '').trim().toLowerCase();
        const isDelivered = ['delivered', 'تم التوصيل'].includes(normalizedStatus);
        if (isDelivered && typeof whatsappRoutes.sendOrderInvoice === 'function') {
            try {
                const invoiceResult = await whatsappRoutes.sendOrderInvoice(id);
                if (invoiceResult?.success) {
                    logger.info(`WhatsApp invoice sent successfully for delivered order #${id} (updateStatus)`);
                } else {
                    logger.error(`WhatsApp invoice failed for delivered order #${id} (updateStatus):`, invoiceResult?.error || 'unknown error');
                }
            } catch (err) {
                logger.error(`Failed to send WhatsApp invoice for delivered order #${id}:`, err.message || err);
            }
        }

        return { success: true };
    }

    async assignCourier(orderId, userId, role, payload, io) {
        const normalizedRole = String(role || '').toLowerCase();
        const isOwner = normalizedRole === 'owner' || normalizedRole === 'partner_owner';
        const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'partner_supervisor';

        if (!isOwner && !isSupervisor) {
            throw new AppError('غير مصرح لك بتعيين المندوب', 403);
        }

        const courierId = Number(payload.courierId);
        if (!Number.isInteger(courierId) || courierId <= 0) {
            throw new AppError('معرف المندوب غير صالح', 400);
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const orderRes = await client.query(
                `SELECT id, supervisor_id, status FROM delivery_orders WHERE id = $1 FOR UPDATE`,
                [orderId]
            );
            if (!orderRes.rows.length) {
                throw new AppError('الطلب غير موجود', 404);
            }

            const order = orderRes.rows[0];
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
