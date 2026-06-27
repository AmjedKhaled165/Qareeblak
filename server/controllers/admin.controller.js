const adminService = require('../services/admin.service');
const adminRepo = require('../repositories/admin.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

exports.getStats = catchAsync(async (req, res) => {
    const stats = await adminRepo.getDashboardStats();
    res.json(stats);
});

exports.getOrders = catchAsync(async (req, res) => {
    const result = await adminService.getOrdersWithPagination(req.query);
    const { obfuscateOrder } = require('../utils/obfuscate');
    res.json({
        orders: result.records.map(obfuscateOrder),
        pagination: {
            nextLastId: result.nextLastId,
            limit: parseInt(req.query.limit) || 25,
            hasMore: result.hasMore
        }
    });
});

exports.getOrderDetail = catchAsync(async (req, res) => {
    const { decodeEntityId, obfuscateOrder } = require('../utils/obfuscate');
    const orderId = decodeEntityId('order', req.params.id) || req.params.id;
    const order = await adminRepo.getOrderWithDetails(orderId);
    if (!order) throw new AppError('الطلب غير موجود', 404);
    const items = await adminRepo.getBookingItems(orderId);
    res.json(obfuscateOrder({ ...order, items }));
});

exports.forceEditOrder = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const orderId = decodeEntityId('order', req.params.id) || req.params.id;
    const success = await adminService.forceEditOrder(req.user.id, orderId, req.body, req.ip);
    if (!success) throw new AppError('الطلب غير موجود', 404);
    res.json({ message: 'تم تعديل الطلب بنجاح ✅' });
});

exports.reassignOrder = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const orderId = decodeEntityId('order', req.params.id) || req.params.id;
    const success = await adminService.reassign(req.user.id, orderId, req.body, req.ip);
    if (!success) throw new AppError('الطلب غير موجود', 404);

    const io = req.app.get('io');
    if (io) io.emit('order_updated', { orderId: req.params.id, type: 'reassign' });

    res.json({ message: 'تم إعادة التعيين بنجاح ✅' });
});

exports.forceStatus = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const orderId = decodeEntityId('order', req.params.id) || req.params.id;
    const success = await adminService.forceStatus(req.user.id, orderId, req.body, req.ip);
    if (!success) throw new AppError('الطلب غير موجود', 404);

    const io = req.app.get('io');
    if (io) io.emit('order_updated', { orderId: req.params.id, type: 'status_change', newStatus: req.body.status });

    res.json({ message: 'تم تغيير الحالة بنجاح ✅' });
});

exports.getUsers = catchAsync(async (req, res) => {
    const { page = 1, limit = 25, type, search, banned } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { obfuscateUser } = require('../utils/obfuscate');
    const result = await adminRepo.getUsers({ type, search, banned, limit: parseInt(limit), offset });
    res.json({
        users: result.records.map(obfuscateUser),
        pagination: { page: parseInt(page), limit: parseInt(limit), total: result.total, totalPages: Math.ceil(result.total / parseInt(limit)) }
    });
});

exports.getUserProfile = catchAsync(async (req, res) => {
    const { decodeEntityId, obfuscateUser } = require('../utils/obfuscate');
    const userId = decodeEntityId('user', req.params.id) || req.params.id;
    const user = await adminRepo.getUserDetailed(userId);
    if (!user) throw new AppError('المستخدم غير موجود', 404);
    delete user.password;
    res.json(obfuscateUser(user));
});

exports.banUser = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('user', req.params.id) || req.params.id;
    const { isBanned, reason } = req.body;
    await adminRepo.banUser(id, isBanned);
    await adminService.audit(req.user.id, isBanned ? 'ban' : 'unban', 'user', id, `${isBanned ? 'Banned' : 'Unbanned'} user #${id}. Reason: ${reason || 'N/A'}`, null, { isBanned, reason }, req.ip);
    res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'} successfully` });
});

exports.editUser = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('user', req.params.id) || req.params.id;
    const old = await adminRepo.getUserDetailed(id);
    if (!old) throw new AppError('المستخدم غير موجود', 404);

    await adminRepo.updateUser(id, req.body);
    await adminService.audit(req.user.id, 'edit_profile', 'user', id, `Edited user #${id} profile`, old, req.body, req.ip);
    res.json({ message: 'تم تحديث بيانات المستخدم ✅' });
});

exports.resetPassword = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const id = decodeEntityId('user', req.params.id) || req.params.id;
    await adminService.resetPassword(req.user.id, id, req.body.newPassword, req.ip);
    res.json({ message: 'تم إعادة تعيين كلمة المرور ✅' });
});

exports.getAvailableCouriers = catchAsync(async (req, res) => {
    const { obfuscateUser } = require('../utils/obfuscate');
    const couriers = await adminRepo.getAvailableCouriers();
    res.json(couriers.map(obfuscateUser));
});

exports.getAuditLogs = catchAsync(async (req, res) => {
    const { page = 1, limit = 30, action, userId, dateFrom } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const result = await adminRepo.getAuditLogs({ action, userId, dateFrom, limit: parseInt(limit), offset });
        res.json({
            logs: result.records,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: result.total, totalPages: Math.ceil(result.total / parseInt(limit)) }
        });
    } catch (error) {
        // HIGH-01: Do NOT read raw log files through the API — path traversal risk + JSON parse crash
        // Return empty result gracefully; ops team should fix the DB audit table separately
        logger.error(`[Admin] Audit log DB query failed: ${error.message}`);
        res.json({ logs: [], pagination: { page: 1, limit: parseInt(limit), total: 0, totalPages: 0 } });
    }
});

exports.getProvidersPerformance = catchAsync(async (req, res) => {
    const { limit = '50', lastId } = req.query;
    const { obfuscateUser } = require('../utils/obfuscate');
    const result = await adminRepo.getProvidersPerformance({
        limit: parseInt(limit, 10),
        lastId: lastId ? parseInt(lastId, 10) : null
    });

    res.json({
        success: true,
        data: result.records.map(r => ({ ...r, provider_id: require('../utils/obfuscate').encodeEntityId('provider', r.provider_id) })),
        pagination: {
            nextLastId: result.nextLastId,
            hasMore: result.hasMore
        }
    });
});

exports.getProviderDetailedReport = catchAsync(async (req, res) => {
    const { decodeEntityId, obfuscateOrder } = require('../utils/obfuscate');
    const id = decodeEntityId('provider', req.params.id) || req.params.id;
    const { limit = '50', lastId } = req.query;

    const result = await adminRepo.getProviderDetailedOrders(id, {
        limit: parseInt(limit, 10),
        lastId: lastId ? parseInt(lastId, 10) : null
    });

    res.json({
        success: true,
        providerId: req.params.id,
        orders: result.records.map(obfuscateOrder),
        pagination: {
            nextLastId: result.nextLastId,
            hasMore: result.hasMore
        }
    });
});

// 💸 FINANCIAL CONTROLLERS (NO MERCY)
exports.getFinanceSummary = catchAsync(async (req, res) => {
    const summary = await adminRepo.getFinanceSummary();
    res.json({ success: true, data: summary });
});

exports.getProviderFinanceReport = catchAsync(async (req, res) => {
    const { id } = req.params;
    const report = await adminRepo.getProviderFinanceReport(id);
    if (!report) throw new AppError('مقدم الخدمة غير موجود', 404);
    res.json({ success: true, data: report });
});

exports.createPayout = catchAsync(async (req, res) => {
    const { providerId, amount, method, reference } = req.body;
    if (!providerId || !amount) throw new AppError('بيانات غير مكتملة', 400);

    const payoutId = await adminRepo.createPayout(providerId, amount, method, reference);
    
    // Audit log for the payout
    await adminService.audit(req.user.id, 'create_payout', 'provider', providerId, 
        `Processed payout of ${amount} to provider #${providerId}. Ref: ${reference}`, 
        null, { amount, method, reference, payoutId }, req.ip);

    res.json({ success: true, message: 'تم تسجيل عملية الصرف بنجاح ✅', payoutId });
});

exports.getPayouts = catchAsync(async (req, res) => {
    const { limit = 50 } = req.query;
    const payouts = await adminRepo.getPayouts(parseInt(limit));
    res.json({ success: true, data: payouts });
});
