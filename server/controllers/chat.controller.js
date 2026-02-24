const chatService = require('../services/chat.service');
const chatRepo = require('../repositories/chat.repository');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

exports.startConsultation = catchAsync(async (req, res, next) => {
    const { providerId } = req.body;
    const customerId = req.user.id; // From verifyToken

    const result = await chatService.startConsultation(customerId, providerId);

    logger.info(`Consultation started: ${result.consultationId} by user ${customerId}`);
    res.status(200).json({ success: true, ...result });
});

exports.getMessages = catchAsync(async (req, res, next) => {
    const { consultationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    const { messages, consultation } = await chatService.getMessages(
        consultationId,
        userId,
        parseInt(limit),
        parseInt(offset)
    );

    res.status(200).json({ success: true, messages, consultation });
});

exports.sendMessage = catchAsync(async (req, res, next) => {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const savedMessage = await chatService.sendMessage(consultationId, userId, req.body);

    const io = req.app.get('io');
    if (io) {
        io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
    }

    res.status(200).json({ success: true, message: savedMessage });
});

exports.uploadImage = catchAsync(async (req, res, next) => {
    const { consultationId } = req.params;
    const userId = req.user.id;
    const { senderType } = req.body;

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'لم يتم تحميل أي صورة' });
    }

    const imageUrl = `/uploads/chat/${req.file.filename}`;

    const savedMessage = await chatService.sendMessage(consultationId, userId, {
        senderType: senderType || 'customer',
        imageUrl
    });

    const io = req.app.get('io');
    if (io) {
        io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
    }

    res.status(200).json({ success: true, message: savedMessage });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const { markedCount, messageIds } = await chatService.markMessagesAsRead(consultationId, userId);

    const io = req.app.get('io');
    if (io && markedCount > 0) {
        io.to(`chat-${consultationId}`).emit('messages-read', {
            consultationId,
            readBy: userId,
            messageIds
        });
    }

    res.status(200).json({ success: true, markedCount });
});

exports.sendQuote = catchAsync(async (req, res, next) => {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const savedMessage = await chatService.sendOrderQuote(consultationId, userId, req.body.items);

    const io = req.app.get('io');
    if (io) {
        io.to(`chat-${consultationId}`).emit('new-message', savedMessage);
    }

    res.status(200).json({ success: true, message: savedMessage });
});

exports.acceptQuote = catchAsync(async (req, res, next) => {
    const { consultationId } = req.params;
    const userId = req.user.id;

    const { booking, sysMsg } = await chatService.acceptQuote(consultationId, userId, req.body);

    const io = req.app.get('io');
    if (io) {
        io.to(`chat-${consultationId}`).emit('new-message', sysMsg);
        io.emit('new-booking', booking);
    }

    res.status(201).json({ success: true, booking, message: 'تم إنشاء الطلب بنجاح' });
});

exports.getProviderConsultations = catchAsync(async (req, res, next) => {
    const { providerId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    // Security check: Is this user the owner/staff of this provider?
    const pUserId = await chatRepo.getUserIdByProviderId ? await chatRepo.getUserIdByProviderId(providerId) : null;
    // Fallback if the repo method doesn't exist yet, we'll add it or check manually
    // Actually let's just do a direct query or check if chatRepo has it.

    // Better: We already have providerId. Let's check if the user is the provider.
    // In chatRepo, we can add a check. For now, let's use a repository check.
    const consultations = await chatRepo.getProviderConsultations(providerId, status, parseInt(limit), parseInt(offset));

    // Security: Filter results or verify provider ownership. 
    // Usually, the providerId is linked to a user. Let's check that link.
    const result = await chatRepo.getProviderInfo(providerId);
    if (!result) throw new AppError('المزود غير موجود', 404);

    // We need to verify if the current user is authorized for this providerId
    // For simplicity, let's add the check here.
    const check = await chatRepo.pool.query('SELECT user_id FROM providers WHERE id = $1', [providerId]);
    if (check.rows.length === 0 || (String(check.rows[0].user_id) !== String(req.user.id) && req.user.role !== 'admin')) {
        throw new AppError('غير مصرح لك بالوصول لقائمة محادثات هذا المزود', 403);
    }

    res.status(200).json({ success: true, consultations });
});
