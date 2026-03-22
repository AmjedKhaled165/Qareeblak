const deliveryRepo = require('../repositories/delivery.repository');
const db = require('../db');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { performAutoAssign } = require('../utils/driver-assignment');
const { syncParentOrderStatus } = require('../utils/parent-sync');
const whatsappRoutes = require('../routes/whatsapp');

class DeliveryService {
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
            io.emit('order-updated', { orderId: id, updates: data });

            if (Object.prototype.hasOwnProperty.call(data, 'status')) {
                io.emit('order-status-changed', { orderId: id, status: data.status });

                const linkedBookings = await deliveryRepo.getLinkedBookings(id);
                for (const b of linkedBookings) {
                    io.emit('booking-updated', { id: b.id, status: data.status, halanOrderId: Number(id) });
                    if (b.parent_order_id) {
                        await syncParentOrderStatus(b.parent_order_id, io);
                    }
                }
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
            io.emit('order-status-changed', { orderId: id, status });
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
                await whatsappRoutes.sendOrderInvoice(id);
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
                io.emit('order-status-changed', { orderId: Number(orderId), status: nextStatus });
                io.emit('booking-updated', { halanOrderId: Number(orderId), status: nextStatus });
            }

            return updatedRes.rows[0] || null;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async updateOrderMeta(orderId, userId, role, payload, io) {
        const normalizedRole = String(role || '').toLowerCase();
        const isOwner = normalizedRole === 'owner' || normalizedRole === 'partner_owner';
        if (!isOwner) {
            throw new AppError('غير مصرح لك بتعديل بيانات الطلب', 403);
        }

        const fields = [];
        const values = [];

        if (Object.prototype.hasOwnProperty.call(payload, 'supervisor_id')) {
            const supervisorId = payload.supervisor_id === null ? null : Number(payload.supervisor_id);
            if (supervisorId !== null) {
                const supervisorRes = await db.query(
                    `SELECT id FROM users WHERE id = $1 AND COALESCE(user_type, '') IN ('supervisor', 'partner_supervisor')`,
                    [supervisorId]
                );
                if (!supervisorRes.rows.length) {
                    throw new AppError('المسؤول غير موجود', 404);
                }
            }
            values.push(supervisorId);
            fields.push(`supervisor_id = $${values.length}`);
        }

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
            io.emit('order-updated', { orderId: Number(orderId) });
            io.emit('booking-updated', { halanOrderId: Number(orderId) });
        }

        return orderRes.rows[0] || updatedRes.rows[0];
    }
}

module.exports = new DeliveryService();
