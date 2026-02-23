const { z } = require('zod');

const halanLoginSchema = z.object({
    identifier: z.string().min(1, 'اسم المستخدم أو البريد مطلوب'),
    password: z.string().min(1, 'كلمة المرور مطلوبة')
});

const halanRegisterSchema = z.object({
    name: z.string().min(1, 'الاسم مطلوب'),
    username: z.string().min(1, 'اسم المستخدم مطلوب'),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
    role: z.enum(['supervisor', 'courier']),
    supervisorId: z.number().int().positive().optional()
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
    halanLoginSchema,
    halanRegisterSchema,
    validate
};
