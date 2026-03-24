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
            const issues = Array.isArray(error?.issues)
                ? error.issues
                : (Array.isArray(error?.errors) ? error.errors : []);
            const errors = issues.length > 0
                ? issues.map((err) => err.message).join(', ')
                : 'بيانات غير صالحة';
            return res.status(400).json({ success: false, error: errors, details: issues });
    }
};

module.exports = {
    registerSchema,
    loginSchema,
    validate
};
