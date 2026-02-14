const { z } = require('zod');

const registerSchema = z.object({
    name: z.string().min(3, 'الاسم يجب أن يكون 3 حروف على الأقل'),
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
    userType: z.enum(['customer', 'provider', 'admin']).optional(),
});

const loginSchema = z.object({
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        const errors = error.errors.map(err => err.message).join(', ');
        return res.status(400).json({ error: errors });
    }
};

module.exports = {
    registerSchema,
    loginSchema,
    validate
};
