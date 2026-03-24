const { z } = require('zod');

const deliveryItemSchema = z.object({
    name: z.string().min(1, 'اسم المنتج مطلوب'),
    price: z.number().nonnegative('السعر يجب أن يكون رقماً موجباً'),
    quantity: z.number().int().positive('الكمية يجب أن تكون رقماً موجباً'),
    providerId: z.number().int().positive().optional(),
    providerName: z.string().optional()
});

const createDeliveryOrderSchema = z.object({
    customerName: z.string().min(1, 'اسم العميل مطلوب'),
    customerPhone: z.string().min(10, 'رقم الهاتف غير صحيح'),
    pickupAddress: z.string().optional().default('المحل / المخزن'),
    deliveryAddress: z.string().min(1, 'عنوان التوصيل مطلوب'),
    pickupLat: z.number().optional().nullable(),
    pickupLng: z.number().optional().nullable(),
    deliveryLat: z.number().optional().nullable(),
    deliveryLng: z.number().optional().nullable(),
    courierId: z.number().int().positive().optional().nullable(),
    customerId: z.number().int().positive().optional().nullable(),
    autoAssign: z.boolean().optional().default(false),
    notes: z.string().optional().nullable(),
    deliveryFee: z.number().nonnegative().optional().default(0),
    items: z.array(deliveryItemSchema).optional(),
    products: z.array(deliveryItemSchema).optional(), // Support legacy naming
    source: z.string().optional().default('manual'),
    orderType: z.enum(['app', 'manual']).optional()
});

const updateDeliveryOrderSchema = createDeliveryOrderSchema.partial().extend({
    status: z.enum(['pending', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled']).optional()
});

const statusUpdateSchema = z.object({
    status: z.enum(['pending', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled']),
    notes: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
});

const positiveIntFromUnknown = z.preprocess((value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
}, z.number().int().positive());

const normalizeSource = (value) => {
    if (value == null) return value;
    const text = String(value).trim().toLowerCase();
    if (!text) return undefined;
    if (text.includes('qareeblak') || text.includes('قريبلك')) return 'qareeblak';
    if (text.includes('manual') || text.includes('يدوي')) return 'manual';
    if (text.includes('whatsapp') || text.includes('واتس') || text.includes('وتس')) return 'whatsapp';
    if (text.includes('maintenance') || text.includes('صيانة')) return 'maintenance';
    return text;
};

const assignCourierSchema = z.object({
    courierId: positiveIntFromUnknown.optional(),
    courier_id: positiveIntFromUnknown.optional(),
    notes: z.string().optional()
}).transform((val) => ({
    courierId: val.courierId ?? val.courier_id,
    notes: val.notes
})).refine((val) => Number.isInteger(val.courierId) && val.courierId > 0, {
    message: 'معرف المندوب مطلوب ويجب أن يكون رقماً صحيحاً'
});

const updateOrderMetaSchema = z.object({
    supervisor_id: z.union([positiveIntFromUnknown, z.null()]).optional(),
    source: z.preprocess(normalizeSource, z.enum(['qareeblak', 'manual', 'whatsapp', 'maintenance'])).optional()
}).refine((val) => Object.keys(val).length > 0, {
    message: 'يجب إرسال حقل واحد على الأقل للتحديث'
});

const courierPricingSchema = z.object({
    deliveryFee: z.number().nonnegative('رسوم التوصيل يجب أن تكون رقماً موجباً'),
    notes: z.string().optional()
});

const validate = (schema, target = 'body') => (req, res, next) => {
    try {
        req[target] = schema.parse(req[target]);
        next();
    } catch (error) {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة', details: error.errors });
    }
};

module.exports = {
    createDeliveryOrderSchema,
    updateDeliveryOrderSchema,
    statusUpdateSchema,
    assignCourierSchema,
    updateOrderMetaSchema,
    courierPricingSchema,
    validate
};
