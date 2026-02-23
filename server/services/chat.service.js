const chatRepo = require('../repositories/chat.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

class ChatService {
    _generateConsultationId(providerId, customerId) {
        return `chat_${providerId}_${customerId}`;
    }

    async _verifyOwnership(consultationId, userId) {
        const consultation = await chatRepo.getConsultationById(consultationId);
        if (!consultation) {
            throw new AppError('المحادثة غير موجودة', 404);
        }
        if (consultation.customer_id !== userId && consultation.provider_id !== userId) {
            logger.warn(`Security Alert: User ${userId} attempted to access consultation ${consultationId} without ownership.`);
            throw new AppError('غير مصرح لك بالوصول لهذه المحادثة', 403);
        }
        return consultation;
    }

    async startConsultation(customerId, providerId) {
        const existingId = await chatRepo.getActiveConsultation(customerId, providerId);
        if (existingId) {
            return { consultationId: existingId, isExisting: true };
        }

        const newId = this._generateConsultationId(providerId, customerId);
        await chatRepo.createConsultation(newId, customerId, providerId);
        return { consultationId: newId, isExisting: false };
    }

    async getMessages(consultationId, userId, limit = 50, offset = 0) {
        const consultation = await this._verifyOwnership(consultationId, userId);
        const messages = await chatRepo.getMessages(consultationId, limit, offset);
        return { messages, consultation };
    }

    async sendMessage(consultationId, userId, { senderType, message, imageUrl }) {
        await this._verifyOwnership(consultationId, userId);

        const savedMessage = await chatRepo.saveMessage({
            consultationId,
            senderId: userId,
            senderType,
            message,
            imageUrl
        });

        await chatRepo.updateConsultationTimestamp(consultationId);
        return savedMessage;
    }

    async markMessagesAsRead(consultationId, userId) {
        await this._verifyOwnership(consultationId, userId);
        const readMessages = await chatRepo.markMessagesAsRead(consultationId, userId);
        return { markedCount: readMessages.length, messageIds: readMessages.map(r => r.id) };
    }

    async sendOrderQuote(consultationId, userId, items) {
        const consult = await this._verifyOwnership(consultationId, userId);

        // Security: Only the provider (pharmacist) can send a quote
        if (consult.provider_id !== userId) {
            throw new AppError('فقط مقدم الخدمة يمكنه إرسال عرض سعر', 403);
        }

        const validItems = items.filter(item => item.name && item.name.trim() && Number(item.price) > 0);
        if (validItems.length === 0) {
            throw new AppError('يجب إضافة منتج واحد على الأقل بسعر صحيح', 400);
        }

        const totalPrice = validItems.reduce((sum, item) => sum + Number(item.price), 0);

        const quoteData = {
            items: validItems.map(item => ({
                name: item.name.trim(),
                price: Number(item.price)
            })),
            totalPrice,
            status: 'pending'
        };

        const savedMessage = await chatRepo.saveMessage({
            consultationId,
            senderId: userId,
            senderType: 'pharmacist',
            message: JSON.stringify(quoteData),
            messageType: 'order_quote'
        });

        await chatRepo.updateConsultationTimestamp(consultationId);
        return savedMessage;
    }

    async acceptQuote(consultationId, userId, { messageId, addressArea, addressDetails, phone }) {
        const consult = await this._verifyOwnership(consultationId, userId);

        // Security: Only the customer can accept a quote
        if (consult.customer_id !== userId) {
            throw new AppError('فقط العميل يمكنه قبول عرض السعر', 403);
        }

        const quoteMsg = await chatRepo.getMessageById(messageId, consultationId, 'order_quote');
        if (!quoteMsg) throw new AppError('العرض غير موجود', 404);

        let quoteData;
        try {
            quoteData = JSON.parse(quoteMsg.message);
        } catch (e) {
            throw new AppError('بيانات العرض غير صالحة', 400);
        }

        if (quoteData.status === 'accepted') {
            throw new AppError('تم قبول هذا العرض مسبقاً', 400);
        }

        const customerInfo = await chatRepo.getUserInfo(userId) || {};
        const providerInfo = await chatRepo.getProviderInfo(consult.provider_id) || {};

        const totalPrice = quoteData.items.reduce((sum, item) => sum + Number(item.price), 0);
        const orderItems = quoteData.items.map(item => ({ name: item.name, quantity: 1, price: item.price }));

        const detailParts = [
            `الطلبات: ${orderItems.map(i => `${i.name} x${i.quantity}`).join(' | ')}`,
            `الإجمالي: ${totalPrice} ج.م`,
            addressArea ? `العنوان: ${addressArea} ${addressDetails ? '- ' + addressDetails : ''}` : '',
            `الهاتف: ${phone || customerInfo.phone || 'غير محدد'}`
        ].filter(Boolean);

        const client = await chatRepo.beginTransaction();
        try {
            const booking = await chatRepo.createBooking({
                customerId: userId,
                providerId: consult.provider_id,
                customerName: customerInfo.name || 'عميل',
                providerName: providerInfo.name || 'صيدلية',
                totalPrice,
                details: detailParts.join(' | '),
                items: JSON.stringify(orderItems)
            }, client);

            quoteData.status = 'accepted';
            quoteData.bookingId = booking.id;

            await chatRepo.updateMessageContent(messageId, JSON.stringify(quoteData), client);
            await chatRepo.updateConsultationStatus(consultationId, 'converted_to_order', booking.id, client);

            const sysMsg = await chatRepo.saveMessage({
                consultationId,
                senderId: userId,
                senderType: 'customer',
                message: `✅ تم قبول العرض وإنشاء الطلب رقم #${booking.id}`,
                messageType: 'system'
            }, client);

            await chatRepo.commitTransaction(client);
            return { booking, sysMsg };
        } catch (error) {
            await chatRepo.rollbackTransaction(client);
            logger.error('[ChatService] acceptQuote transaction failed:', error);
            throw error;
        }
    }
}

module.exports = new ChatService();
