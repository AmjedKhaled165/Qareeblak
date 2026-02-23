const { z } = require('zod');

const offerSchema = z.object({
    type: z.string(),
    discountPercent: z.number().optional().nullable(),
    bundleCount: z.number().int().optional().nullable(),
    bundleFreeCount: z.number().int().optional().nullable(),
    endDate: z.string().optional().nullable()
});

const createServiceSchema = z.object({
    providerId: z.number().int().positive(),
    name: z.string().min(1, 'اسم الخدمة مطلوب'),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    image: z.string().optional(),
    offer: offerSchema.optional()
});

const updateServiceSchema = createServiceSchema.partial();

const validate = (schema, target = 'body') => (req, res, next) => {
    try {
        req[target] = schema.parse(req[target]);
        next();
    } catch (error) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة', details: error.errors });
    }
};

module.exports = {
    createServiceSchema,
    updateServiceSchema,
    validate
};
