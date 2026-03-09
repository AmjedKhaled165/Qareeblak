const chatService = require('../services/chat.service');
const chatRepo = require('../repositories/chat.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
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
    const { limit = 50, lastId = null } = req.query; // lastId بدل offset
    const userId = req.user.id;

    const { messages, consultation, nextLastId, hasMore } = await chatService.getMessages(
        consultationId,
        userId,
        parseInt(limit),
        lastId ? parseInt(lastId) : null
    );

    res.status(200).json({ success: true, messages, consultation, nextLastId, hasMore });
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

    // S3 uploads expose the URL in req.file.location
    // Local disk fallback (dev-only) exposes req.file.filename
    const imageUrl = req.file.location
        ? req.file.location
        : `/uploads/chat/${req.file.filename}`;

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
    const { status, limit = 20, lastId = null } = req.query; // cursor-based

    // Security check: only the owner of this provider can view their consultations
    const check = await chatRepo.pool.query('SELECT user_id FROM providers WHERE id = $1', [providerId]);
    if (!check.rows.length || (String(check.rows[0].user_id) !== String(req.user.id) && req.user.user_type !== 'admin')) {
        throw new AppError('غير مصرح لك بالوصول لقائمة محادثات هذا المزود', 403);
    }

    const consultations = await chatRepo.getProviderConsultations(
        providerId, status, parseInt(limit), lastId ? parseInt(lastId) : null
    );

    res.status(200).json({
        success: true,
        consultations,
        nextLastId: consultations.length > 0 ? consultations[consultations.length - 1].id : null,
        hasMore: consultations.length === parseInt(limit)
    });
});
