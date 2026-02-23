const { z } = require('zod');

const banUserSchema = z.object({
    isBanned: z.boolean(),
    reason: z.string().optional()
});

const editUserSchema = z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional()
});

const resetPasswordSchema = z.object({
    newPassword: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل')
});

const forceEditOrderSchema = z.object({
    price: z.number().nonnegative().optional(),
    delivery_fee: z.number().nonnegative().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        name: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative()
    })).optional()
});

const reassignOrderSchema = z.object({
    courier_id: z.number().int().positive().optional(),
    provider_id: z.number().int().positive().optional()
});

const forceStatusSchema = z.object({
    status: z.string().min(1),
    reason: z.string().optional()
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
    banUserSchema,
    editUserSchema,
    resetPasswordSchema,
    forceEditOrderSchema,
    reassignOrderSchema,
    forceStatusSchema,
    validate
};
