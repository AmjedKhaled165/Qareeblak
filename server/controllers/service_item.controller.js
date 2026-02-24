const serviceRepo = require('../repositories/service_item.repository');
const providerRepo = require('../repositories/provider.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.create = catchAsync(async (req, res, next) => {
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

    const id = await serviceRepo.create(providerId, req.body);
    res.status(201).json({
        success: true,
        message: 'تم إضافة الصنف بنجاح ليظهر لجميع العملاء',
        id: id.toString()
    });
});

exports.update = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const isAdmin = req.user.user_type === 'admin';
    const providerId = await providerRepo.getProviderIdByUserId(userId);

    const updated = await serviceRepo.updateSecure(req.params.id, providerId, req.body, isAdmin);

    if (!updated) {
        throw new AppError('لم يتم العثور على الصنف أو لا تملك صلاحية تعديله', 404);
    }

    res.json({ success: true, message: 'تم تحديث البيانات بنجاح' });
});

exports.delete = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const isAdmin = req.user.user_type === 'admin';
    const providerId = await providerRepo.getProviderIdByUserId(userId);

    const deleted = await serviceRepo.deleteSecure(req.params.id, providerId, isAdmin);

    if (!deleted) {
        throw new AppError('لم يتم العثور على الصنف أو لا تملك صلاحية حذفه', 404);
    }

    res.json({ success: true, message: 'تم حذف الصنف بنجاح' });
});

exports.getByProvider = catchAsync(async (req, res, next) => {
    const services = await serviceRepo.getByProvider(req.params.providerId);
    const formatted = services.map(s => ({
        id: s.id.toString(),
        name: s.name,
        description: s.description,
        price: parseFloat(s.price),
        image: s.image,
        offer: s.has_offer ? {
            type: s.offer_type,
            discountPercent: s.discount_percent,
            bundleCount: s.bundle_count,
            bundleFreeCount: s.bundle_free_count,
            endDate: s.offer_end_date
        } : undefined
    }));
    res.json(formatted);
});
