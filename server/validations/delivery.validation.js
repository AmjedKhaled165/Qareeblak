const { z } = require('zod');

const flexibleIdSchema = z.preprocess((value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : trimmed;
    }
    if (value === null) return undefined;
    return value;
}, z.union([z.number().int().positive(), z.string()]).optional());

const deliveryItemSchema = z.object({
    name: z.string().optional(),
    name_ar: z.string().optional(),
    price: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().nonnegative().default(0)),
    unit_price: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().nonnegative().default(0)),
    total_price: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().nonnegative().default(0)),
    quantity: z.preprocess((val) => {
        const num = Number(val);
        return isNaN(num) || num < 1 ? 1 : num;
    }, z.number().int().positive().default(1)),
    providerId: flexibleIdSchema,
    provider_id: flexibleIdSchema,
    providerName: z.string().optional(),
    provider_name: z.string().optional(),
    notes: z.string().optional().nullable(),
    extra_service_type: z.string().optional(),
    utility_type: z.string().optional().nullable(),
    amount_specified: z.boolean().optional(),
    charge_amount: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().nonnegative().optional()),
}).transform((val) => {
    const finalName = val.name || val.name_ar || 'عنصر طلب';
    const finalPrice = val.price || val.unit_price || val.total_price || val.charge_amount || 0;
    return {
        name: finalName,
        name_ar: finalName,
        price: finalPrice,
        unit_price: finalPrice,
        total_price: finalPrice * (val.quantity || 1),
        quantity: val.quantity || 1,
        providerId: val.providerId ?? val.provider_id,
        providerName: val.providerName ?? val.provider_name,
        notes: val.notes,
        extra_service_type: val.extra_service_type,
        utility_type: val.utility_type,
        amount_specified: val.amount_specified,
        charge_amount: val.charge_amount,
    };
});

const createDeliveryOrderSchema = z.object({
    customerName: z.string().optional(),
    customer_name: z.string().optional(),
    customerPhone: z.string().optional(),
    customer_phone: z.string().optional(),
    pickupAddress: z.string().optional(),
    pickup_address: z.string().optional(),
    deliveryAddress: z.string().optional(),
    delivery_address: z.string().optional(),
    pickupLat: z.number().optional().nullable(),
    pickupLng: z.number().optional().nullable(),
    deliveryLat: z.number().optional().nullable(),
    deliveryLng: z.number().optional().nullable(),
    courierId: flexibleIdSchema,
    courier_id: flexibleIdSchema,
    customerId: flexibleIdSchema,
    customer_id: flexibleIdSchema,
    autoAssign: z.boolean().optional().default(false),
    notes: z.string().optional().nullable(),
    deliveryFee: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().nonnegative().default(0)),
    delivery_fee: z.preprocess((val) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().nonnegative().default(0)),
    items: z.array(deliveryItemSchema).optional(),
    products: z.array(deliveryItemSchema).optional(),
    source: z.string().optional().default('manual'),
    orderType: z.string().optional(),
    order_type: z.string().optional(),
}).transform((val) => {
    const name = val.customerName || val.customer_name || 'عميل قريبلك';
    const phone = val.customerPhone || val.customer_phone || '';
    const dAddress = val.deliveryAddress || val.delivery_address || 'عنوان التوصيل';
    const pAddress = val.pickupAddress || val.pickup_address || 'المحل / المخزن';
    const fee = val.deliveryFee || val.delivery_fee || 0;
    const itemsList = val.items || val.products || [];

    return {
        customerName: name,
        customer_name: name,
        customerPhone: phone,
        customer_phone: phone,
        pickupAddress: pAddress,
        pickup_address: pAddress,
        deliveryAddress: dAddress,
        delivery_address: dAddress,
        pickupLat: val.pickupLat,
        pickupLng: val.pickupLng,
        deliveryLat: val.deliveryLat,
        deliveryLng: val.deliveryLng,
        courierId: val.courierId ?? val.courier_id,
        customerId: val.customerId ?? val.customer_id,
        autoAssign: val.autoAssign,
        notes: val.notes,
        deliveryFee: fee,
        delivery_fee: fee,
        items: itemsList,
        products: itemsList,
        source: val.source || 'manual',
        orderType: val.orderType || val.order_type || 'manual',
        order_type: val.orderType || val.order_type || 'manual',
    };
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
    courierId: flexibleIdSchema,
    courier_id: flexibleIdSchema,
    notes: z.string().optional()
}).transform((val) => ({
    courierId: val.courierId ?? val.courier_id,
    notes: val.notes
})).refine((val) => (typeof val.courierId === 'number' || typeof val.courierId === 'string') && val.courierId !== '', {
    message: 'معرف المندوب مطلوب'
});

const updateOrderMetaSchema = z.object({
    supervisor_id: flexibleIdSchema,
    source: z.preprocess(normalizeSource, z.enum(['qareeblak', 'manual', 'whatsapp', 'maintenance'])).optional()
}).refine((val) => Object.keys(val).length > 0, {
    message: 'يجب إرسال حقل واحد على الأقل للتحديث'
});

const courierPricingSchema = z.object({
    deliveryFee: z.number().nonnegative('رسوم التوصيل يجب أن تكون رقماً موجباً'),
    notes: z.string().optional(),
    items: z.any().optional()
});

const validate = (schema, target = 'body') => (req, res, next) => {
    try {
        req[target] = schema.parse(req[target]);
        next();
    } catch (error) {
        const issues = error.issues || error.errors || [];
        console.error("Delivery validation failed:", JSON.stringify(issues, null, 2));
        const messages = issues.map(e => e.message).join(', ');
        return res.status(400).json({ success: false, error: messages || 'بيانات غير صالحة', details: issues });
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
