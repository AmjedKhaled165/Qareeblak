const { z } = require('zod');

const checkoutSchema = z.object({
    items: z.array(z.object({
        providerId: z.number().int().positive('معرف مقدم الخدمة غير صالح'),
        providerName: z.string().min(1, 'اسم مقدم الخدمة مطلوب'),
        price: z.number().nonnegative('السعر يجب أن يكون رقماً موجباً'),
        quantity: z.number().int().positive('الكمية يجب أن تكون رقماً موجباً'),
        name: z.string().min(1, 'اسم المنتج مطلوب')
    })).min(1, 'السلة فارغة لا يمكن إتمام الطلب'),
    addressInfo: z.object({
        area: z.string().min(1, 'المنطقة مطلوبة').max(200),
        details: z.string().max(500).optional(),
        phone: z.string().min(10, 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل').max(20)
    }).optional(),
    userPrizeId: z.number().int().positive().optional()
});

const createBookingSchema = z.object({
    providerId: z.number().int().positive(),
    serviceId: z.number().int().positive().optional().nullable(),
    userName: z.string().min(1),
    serviceName: z.string().min(1),
    providerName: z.string().min(1),
    price: z.number().nonnegative(),
    details: z.string().max(1000).optional(),
    items: z.array(z.any()).optional(),
    bundleId: z.string().optional().nullable(),
    appointmentDate: z.string().datetime({ message: "Invalid datetime array" }).optional().nullable(),
    appointmentType: z.enum(['immediate', 'maintenance']).optional()
});

const updateStatusSchema = z.object({
    status: z.enum(['pending', 'pending_appointment', 'confirmed', 'completed', 'cancelled', 'rejected']),
    price: z.number().nonnegative().optional()
});

const rescheduleSchema = z.object({
    newDate: z.string().datetime({ message: "تاريخ الموعد غير صالح" }),
    updatedBy: z.enum(['customer', 'provider'])
});

const acceptAppointmentSchema = z.object({
    acceptedBy: z.enum(['customer', 'provider']).optional()
});

const getBookingsQuerySchema = z.object({
    lastId: z.string().regex(/^\d+$/).transform(Number).optional().nullable(),
    limit: z.string().regex(/^\d+$/).transform(val => Math.min(Number(val), 100)).optional().default("20")
});

const validateIdParam = z.object({
    id: z.string().regex(/^\d+$/, 'معرف الحجز يجب أن يكون رقماً')
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
    checkoutSchema,
    createBookingSchema,
    updateStatusSchema,
    rescheduleSchema,
    acceptAppointmentSchema,
    getBookingsQuerySchema,
    validateIdParam,
    validate
};
