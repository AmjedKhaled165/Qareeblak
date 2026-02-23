const deliveryRepo = require('../repositories/delivery.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { performAutoAssign } = require('../utils/driver-assignment');
const { syncParentOrderStatus } = require('../utils/parent-sync');

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

        return { success: true };
    }
}

module.exports = new DeliveryService();
