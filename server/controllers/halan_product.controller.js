const productRepo = require('../repositories/halan_product.repository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAll = catchAsync(async (req, res) => {
    const products = await productRepo.getAll();
    res.json({ success: true, data: products });
});

exports.create = catchAsync(async (req, res) => {
    if (req.user.role !== 'owner') throw new AppError('Unauthorized', 403);
    const { name } = req.body;
    if (!name) throw new AppError('اسم المنتج مطلوب', 400);

    const product = await productRepo.create(name);
    if (!product) throw new AppError('هذا المنتج موجود بالفعل', 400);

    res.json({ success: true, data: product });
});

exports.delete = catchAsync(async (req, res) => {
    if (req.user.role !== 'owner') throw new AppError('Unauthorized', 403);
    await productRepo.delete(req.params.id);
    res.json({ success: true, message: 'تم حذف المنتج' });
});
