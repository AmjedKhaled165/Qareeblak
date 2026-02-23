const providerService = require('../services/provider.service');
const providerRepo = require('../repositories/provider.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAll = catchAsync(async (req, res) => {
    const providers = await providerService.getProviders();
    res.json(providers);
});

exports.search = catchAsync(async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);
    const results = await providerRepo.search(q);
    res.json(results.map(p => ({
        id: p.id.toString(),
        name: p.name,
        category: p.category,
        phone: p.phone
    })));
});

exports.getById = catchAsync(async (req, res) => {
    const provider = await providerService.getProviderById(req.params.id);
    if (!provider) throw new AppError('مقدم الخدمة غير موجود', 404);
    res.json(provider);
});

exports.getByEmail = catchAsync(async (req, res) => {
    const provider = await providerService.getProviderByEmail(req.params.email);
    if (!provider) throw new AppError('مقدم الخدمة غير موجود', 404);
    res.json(provider);
});

exports.addReview = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { userName, rating, comment } = req.body;
    await providerRepo.addReview({ providerId: id, userName, rating, comment });
    res.status(201).json({ message: 'تم إضافة التقييم بنجاح' });
});

exports.deleteProvider = catchAsync(async (req, res) => {
    const success = await providerRepo.deleteProvider(req.params.id);
    if (!success) throw new AppError('مقدم الخدمة غير موجود', 404);
    res.json({ message: 'تم حذف مقدم الخدمة بنجاح' });
});
exports.updateProfile = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const isAdmin = req.user.user_type === 'admin';

    let providerId;
    if (isAdmin && req.body.providerId) {
        providerId = req.body.providerId;
    } else {
        providerId = await providerRepo.getProviderIdByUserId(userId);
    }

    if (!providerId) {
        throw new AppError('لا يملك هذا الحساب ملف مقدم خدمة مفعل', 403);
    }

    await providerRepo.updateProvider(providerId, req.body);
    res.json({ success: true, message: 'تم تحديث بيانات المتجر بنجاح' });
});
