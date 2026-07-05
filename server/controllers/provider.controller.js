const providerService = require('../services/provider.service');
const providerRepo = require('../repositories/provider.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAll = catchAsync(async (req, res) => {
    const { lastId, limit = 20 } = req.query;
    const result = await providerService.getProviders(lastId || null, limit);
    res.json(result);
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
    const { decodeEntityId } = require('../utils/obfuscate');
    const decodedId = decodeEntityId('provider', req.params.id) || req.params.id;
    const provider = await providerService.getProviderById(decodedId);
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
    const { decodeEntityId } = require('../utils/obfuscate');
    const decodedId = decodeEntityId('provider', id) || id;
    const { userName, rating, comment } = req.body;
    await providerRepo.addReview({ providerId: decodedId, userName, rating, comment });
    res.status(201).json({ message: 'تم إضافة التقييم بنجاح' });
});

exports.deleteProvider = catchAsync(async (req, res) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const decodedId = decodeEntityId('provider', req.params.id) || req.params.id;
    const success = await providerRepo.deleteProvider(decodedId);
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
    res.json({ success: true, message: 'تم تحديث الملف الشخصي بنجاح' });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const { isOnline } = req.body;

    if (isOnline === undefined) {
        throw new AppError('يرجى تحديد حالة الاتصال', 400);
    }

    await providerService.updateStatus(userId, isOnline);
    res.json({ success: true, message: 'تم تحديث حالة الاتصال بنجاح', isOnline });
});
