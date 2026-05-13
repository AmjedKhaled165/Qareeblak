const { z } = require('zod');

const startConsultationSchema = z.object({
    providerId: z.number().int().positive('معرف مقدم الخدمة غير صالح')
});

const sendMessageSchema = z.object({
    message: z.string().max(1000, 'الرسالة تتجاوز الحد المسموح (1000 حرف)').optional(),
    senderType: z.enum(['customer', 'pharmacist']),
    senderName: z.string().max(100).optional(),
    imageUrl: z.string().url().max(500).optional()
}).refine(data => data.message || data.imageUrl, {
    message: "يجب توفير رسالة نصية أو صورة",
});

const sendQuoteSchema = z.object({
    items: z.array(z.object({
        name: z.string().min(1, 'اسم المنتج مطلوب').max(200),
        price: z.number().positive('السعر يجب أن يكون رقماً صحيحاً')
    })).min(1, 'يجب إضافة منتج واحد على الأقل').max(50, 'تم تجاوز الحد الأقصى للمنتجات')
});

const acceptQuoteSchema = z.object({
    messageId: z.number().int().positive('معرف الرسالة غير صالح'),
    addressArea: z.string().max(200).optional(),
    addressDetails: z.string().max(500).optional(),
    phone: z.string().max(20).optional()
});

const validateParams = z.object({
    consultationId: z.string().min(5).max(100)
});

// Zod Middleware
const validate = (schema, target = 'body') => (req, res, next) => {
    try {
        req[target] = schema.parse(req[target]);
        next();
    } catch (error) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة', details: error.errors });
    }
};

module.exports = {
    startConsultationSchema,
    sendMessageSchema,
    sendQuoteSchema,
    acceptQuoteSchema,
    validateParams,
    validate
};
