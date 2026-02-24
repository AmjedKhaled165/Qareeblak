const deliveryService = require('../services/delivery.service');
const deliveryRepo = require('../repositories/delivery.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getOrders = catchAsync(async (req, res, next) => {
    const result = await deliveryService.getOrders(req.user, req.query);
    res.status(200).json({
        success: true,
        data: result.records,
        pagination: {
            total: result.total,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            totalPages: Math.ceil(result.total / (parseInt(req.query.limit) || 50))
        }
    });
});

exports.getOrder = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;

    const order = await deliveryRepo.getOrderByIdSecure(req.params.id, { userId, role });
    if (!order) throw new AppError('الطلب غير موجود أو غير مصرح لك بمشاهدته', 404);

    // Filter sub-orders
    const subOrders = await deliveryRepo.getLinkedBookings(req.params.id);
    order.sub_orders = subOrders;

    res.status(200).json({ success: true, data: order });
});

exports.createOrder = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;

    const order = await deliveryService.createOrder(userId, role, req.body);
    res.status(201).json({ success: true, data: order });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const role = req.user.role || req.user.type;
    const { id } = req.params;
    const io = req.app.get('io');

    await deliveryService.updateStatus(id, userId, role, req.body, io);
    res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب بنجاح' });
});

exports.softDelete = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await deliveryRepo.softDelete(id);
    res.status(200).json({ success: true, message: 'تم حذف الطلب بنجاح' });
});

exports.autoAssign = catchAsync(async (req, res, next) => {
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { performAutoAssign } = require('../utils/driver-assignment');
    const io = req.app.get('io');

    const result = await performAutoAssign(id, userId, io);
    res.status(200).json({ success: true, message: `تم تعيين الطلب للمندوب ${result.name}`, courier: result });
});
