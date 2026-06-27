const serviceRepo = require('../repositories/service_item.repository');
const providerRepo = require('../repositories/provider.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { invalidatePattern } = require('../utils/redis-cache');

exports.create = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const isAdmin = req.user.user_type === 'admin';

    let providerId;
    const { decodeEntityId } = require('../utils/obfuscate');
    if (isAdmin && req.body.providerId) {
        const decoded = decodeEntityId('provider', req.body.providerId);
        if (decoded === null && isNaN(req.body.providerId)) {
            return res.status(400).json({ success: false, error: 'معرف مزود الخدمة غير صالح' });
        }
        providerId = decoded || req.body.providerId;
    } else {
        providerId = await providerRepo.getProviderIdByUserId(userId);
    }

    if (!providerId) {
        throw new AppError('لا يملك هذا الحساب ملف مقدم خدمة مفعل', 403);
    }

    const id = await serviceRepo.create(providerId, req.body);
    
    // Invalidate caches so the new service appears immediately
    await invalidatePattern('route:/api/providers*');
    await invalidatePattern('route:/api/services*');
    await invalidatePattern('route:/providers*');
    await invalidatePattern('route:/services*');
    await invalidatePattern('providers:list:*');

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
        io.to(`provider-${providerId}`).emit('services_updated');
    }

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

    // Invalidate caches
    await invalidatePattern('route:/api/providers*');
    await invalidatePattern('route:/api/services*');
    await invalidatePattern('route:/providers*');
    await invalidatePattern('route:/services*');
    await invalidatePattern('providers:list:*');

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
        io.to(`provider-${providerId}`).emit('services_updated');
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

    // Invalidate caches
    await invalidatePattern('route:/api/providers*');
    await invalidatePattern('route:/api/services*');
    await invalidatePattern('route:/providers*');
    await invalidatePattern('route:/services*');
    await invalidatePattern('providers:list:*');

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
        io.to(`provider-${providerId}`).emit('services_updated');
    }

    res.json({ success: true, message: 'تم حذف الصنف بنجاح' });
});

exports.getByProvider = catchAsync(async (req, res, next) => {
    const { decodeEntityId } = require('../utils/obfuscate');
    const decoded = decodeEntityId('provider', req.params.providerId);
    if (decoded === null && isNaN(req.params.providerId)) { console.error('DECODE FAILED FOR:', req.params.providerId); return res.status(400).json({error: 'Invalid provider ID'}); }
    const providerId = decoded || req.params.providerId;
    const services = await serviceRepo.getByProvider(providerId);
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
