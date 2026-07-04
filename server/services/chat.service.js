const chatRepo = require('../repositories/chat.repository');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

class ChatService {
    async _verifyOwnership(consultationId, userId) {
        const consultation = await chatRepo.getConsultationById(consultationId);
        if (!consultation) {
            throw new AppError('المحادثة غير موجودة', 404);
        }
        
        // Check if user is the customer
        if (String(consultation.customer_id) === String(userId)) {
            return consultation;
        }

        // Check if user owns the provider
        const pool = require('../db');
        const check = await pool.query('SELECT user_id FROM providers WHERE id = $1', [consultation.provider_id]);
        if (check.rows.length > 0 && String(check.rows[0].user_id) === String(userId)) {
            return consultation;
        }

        logger.warn(`Security Alert: User ${userId} attempted to access consultation ${consultationId} without ownership.`);
        throw new AppError('غير مصرح لك بالوصول لهذه المحادثة', 403);
    }

    async startConsultation(customerId, providerId) {
        const existingId = await chatRepo.getActiveConsultation(customerId, providerId);
        if (existingId) {
            return { consultationId: String(existingId), isExisting: true };
        }

        const newId = await chatRepo.createConsultation(customerId, providerId);
        return { consultationId: String(newId), isExisting: false };
    }

    async getMessages(consultationId, userId, limit = 50, lastId = null) {
        const consultation = await this._verifyOwnership(consultationId, userId);
        const messages = await chatRepo.getMessages(consultationId, limit, lastId);
        const nextLastId = messages.length > 0 ? messages[0].id : null; // lowest id in the current batch
        return { messages, consultation, nextLastId, hasMore: messages.length === limit };
    }

    async sendMessage(consultationId, userId, { senderType, message, imageUrl }) {
        const consult = await this._verifyOwnership(consultationId, userId);

        const savedMessage = await chatRepo.saveMessage({
            consultationId,
            senderId: userId,
            senderType,
            message,
            imageUrl
        });

        await chatRepo.updateConsultationTimestamp(consultationId);
        
        // Notify the other party
        let recipientId;
        if (String(userId) === String(consult.customer_id)) {
            const providerRepo = require('../repositories/provider.repository');
            const provider = await providerRepo.getById(consult.provider_id);
            if (provider && provider.user_id) {
                recipientId = provider.user_id;
            }
        } else {
            recipientId = consult.customer_id;
        }
        
        if (recipientId) {
            const msgType = imageUrl ? 'أرسل صورة' : message;
            const { createNotification } = require('../routes/notifications');
            createNotification(recipientId, 'رسالة جديدة', msgType, 'chat_alert', String(consultationId)).catch(e => logger.error('Chat notification error:', e));
        }

        return savedMessage;
    }

    async markMessagesAsRead(consultationId, userId) {
        await this._verifyOwnership(consultationId, userId);
        const readMessages = await chatRepo.markMessagesAsRead(consultationId, userId);
        return { markedCount: readMessages.length, messageIds: readMessages.map(r => r.id) };
    }

    async sendOrderQuote(consultationId, userId, payload) {
        const { items, appointmentDate, appointmentTime, appointmentType } = Array.isArray(payload) ? { items: payload } : payload;
        const consult = await this._verifyOwnership(consultationId, userId);

        // Security: Only the provider (pharmacist/car service) can send a quote
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
            status: 'pending',
            appointmentDate: appointmentDate || null,
            appointmentTime: appointmentTime || null,
            appointmentType: appointmentType || null
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

        const client = await chatRepo.beginTransaction();
        try {
            // [ENTERPRISE HARDENING] Atomic lock: Lock the message row to prevent parallel acceptance race conditions
            const lockRes = await client.query(
                'SELECT message FROM chat_messages WHERE id = $1 AND consultation_id = $2 FOR UPDATE',
                [messageId, consultationId]
            );

            if (lockRes.rows.length === 0) throw new AppError('العرض غير موجود', 404);

            const quoteData = JSON.parse(lockRes.rows[0].message);
            if (quoteData.status === 'accepted') {
                throw new AppError('تم قبول هذا العرض مسبقاً', 400);
            }

            const [customerInfo, providerInfo] = await Promise.all([
                chatRepo.getUserInfo(userId).catch(() => ({})),
                chatRepo.getProviderInfo(consult.provider_id).catch(() => ({})),
            ]);

            const totalPrice = quoteData.items.reduce((sum, item) => sum + Number(item.price), 0);
            const orderItems = quoteData.items.map(item => ({ name: item.name, quantity: 1, price: item.price }));

            const detailParts = [
                `الطلبات: ${orderItems.map(i => `${i.name} x${i.quantity}`).join(' | ')}`,
                `الإجمالي: ${totalPrice} ج.م`,
                addressArea ? `العنوان: ${addressArea} ${addressDetails ? '- ' + addressDetails : ''}` : '',
                `الهاتف: ${phone || customerInfo.phone || 'غير محدد'}`
            ].filter(Boolean);

            const booking = await chatRepo.createBooking({
                customerId: userId,
                providerId: consult.provider_id,
                customerName: customerInfo.name || 'عميل',
                providerName: providerInfo.name || 'مقدم خدمة',
                totalPrice,
                details: detailParts.join(' | '),
                items: JSON.stringify(orderItems),
                appointmentType: quoteData.appointmentType,
                appointmentDate: quoteData.appointmentDate ? `${quoteData.appointmentDate}${quoteData.appointmentTime ? 'T' + quoteData.appointmentTime : ''}` : null
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
            
            // Send notification to provider
            if (providerInfo && providerInfo.user_id) {
                const { createNotification } = require('../routes/notifications');
                createNotification(
                    providerInfo.user_id,
                    'طلب جديد',
                    `تم إنشاء طلب جديد برقم #${booking.id} من العميل ${customerInfo.name}`,
                    'order_alert',
                    String(booking.id)
                ).catch(e => logger.error('Booking notification error:', e));
            }
            
            return { booking, sysMsg };

        } catch (error) {
            await chatRepo.rollbackTransaction(client);
            logger.error('[ChatService] acceptQuote transaction failed:', error);
            if (error instanceof AppError) throw error;
            throw new AppError('فشل قبول عرض السعر، يرجى المحاولة مرة أخرى', 500);
        }
    }
}

module.exports = new ChatService();
