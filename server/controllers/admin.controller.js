const adminService = require('../services/admin.service');
const adminRepo = require('../repositories/admin.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const fs = require('fs').promises;
const path = require('path');

exports.getStats = catchAsync(async (req, res) => {
    const stats = await adminRepo.getDashboardStats();
    res.json(stats);
});

exports.getOrders = catchAsync(async (req, res) => {
    const result = await adminService.getOrdersWithPagination(req.query);
    res.json({
        orders: result.records,
        pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 25,
            total: result.total,
            totalPages: Math.ceil(result.total / (parseInt(req.query.limit) || 25))
        }
    });
});

exports.getOrderDetail = catchAsync(async (req, res) => {
    const order = await adminRepo.getOrderWithDetails(req.params.id);
    if (!order) throw new AppError('الطلب غير موجود', 404);
    const items = await adminRepo.getBookingItems(req.params.id);
    res.json({ ...order, items });
});

exports.forceEditOrder = catchAsync(async (req, res) => {
    const success = await adminService.forceEditOrder(req.user.id, req.params.id, req.body, req.ip);
    if (!success) throw new AppError('الطلب غير موجود', 404);
    res.json({ message: 'تم تعديل الطلب بنجاح ✅' });
});

exports.reassignOrder = catchAsync(async (req, res) => {
    const success = await adminService.reassign(req.user.id, req.params.id, req.body, req.ip);
    if (!success) throw new AppError('الطلب غير موجود', 404);

    const io = req.app.get('io');
    if (io) io.emit('order_updated', { orderId: req.params.id, type: 'reassign' });

    res.json({ message: 'تم إعادة التعيين بنجاح ✅' });
});

exports.forceStatus = catchAsync(async (req, res) => {
    const success = await adminService.forceStatus(req.user.id, req.params.id, req.body, req.ip);
    if (!success) throw new AppError('الطلب غير موجود', 404);

    const io = req.app.get('io');
    if (io) io.emit('order_updated', { orderId: req.params.id, type: 'status_change', newStatus: req.body.status });

    res.json({ message: 'تم تغيير الحالة بنجاح ✅' });
});

exports.getUsers = catchAsync(async (req, res) => {
    const { page = 1, limit = 25, type, search, banned } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await adminRepo.getUsers({ type, search, banned, limit: parseInt(limit), offset });
    res.json({
        users: result.records,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: result.total, totalPages: Math.ceil(result.total / parseInt(limit)) }
    });
});

exports.getUserProfile = catchAsync(async (req, res) => {
    const user = await adminRepo.getUserDetailed(req.params.id);
    if (!user) throw new AppError('المستخدم غير موجود', 404);
    delete user.password;
    res.json(user);
});

exports.banUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { isBanned, reason } = req.body;
    await adminRepo.banUser(id, isBanned);
    await adminService.audit(req.user.id, isBanned ? 'ban' : 'unban', 'user', id, `${isBanned ? 'Banned' : 'Unbanned'} user #${id}. Reason: ${reason || 'N/A'}`, null, { isBanned, reason }, req.ip);
    res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'} successfully` });
});

exports.editUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const old = await adminRepo.getUserDetailed(id);
    if (!old) throw new AppError('المستخدم غير موجود', 404);

    await adminRepo.updateUser(id, req.body);
    await adminService.audit(req.user.id, 'edit_profile', 'user', id, `Edited user #${id} profile`, old, req.body, req.ip);
    res.json({ message: 'تم تحديث بيانات المستخدم ✅' });
});

exports.resetPassword = catchAsync(async (req, res) => {
    await adminService.resetPassword(req.user.id, req.params.id, req.body.newPassword, req.ip);
    res.json({ message: 'تم إعادة تعيين كلمة المرور ✅' });
});

exports.getAvailableCouriers = catchAsync(async (req, res) => {
    const couriers = await adminRepo.getAvailableCouriers();
    res.json(couriers);
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
        // Fallback to file mapping if table fails
        const logPath = path.join(__dirname, '../../logs/combined.log');
        const data = await fs.readFile(logPath, 'utf8');
        const logs = data.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)).reverse().slice(0, 100);
        res.json({ logs, pagination: { page: 1, limit: 100, total: logs.length, totalPages: 1 } });
    }
});
