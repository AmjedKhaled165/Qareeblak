const { z } = require('zod');

const registerSchema = z.object({
    name: z.string()
        .min(5, 'يرجى كتابة الاسم ثنائياً على الأقل')
        .max(50)
        .regex(/^[\u0600-\u06FFa-zA-Z\s]+$/, 'الاسم يجب أن يحتوي على حروف فقط'),
    email: z.string().email('بريد إلكتروني غير صالح'),
    // Compatibility: frontend may still send userType.
    // We accept it to avoid 400, while backend service still forces "customer".
    userType: z.enum(['customer', 'provider', 'admin']).optional(),
    password: z.string()
        .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
        .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كابيتال واحد على الأقل')
        .regex(/[a-z]/, 'يجب أن تحتوي على حرف صغير واحد على الأقل')
        .regex(/[0-9]/, 'يجب أن تحتوي على رقم واحد على الأقل'),
}).strict();

const loginSchema = z.object({
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

const providerRequestSchema = z.object({
    name: z.string().min(3, 'اسم العلامة التجارية يجب أن يكون 3 حروف على الأقل'),
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
    phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
    category: z.string().min(1, 'التصنيف مطلوب'),
    location: z.string().min(1, 'الموقع مطلوب'),
}).strict();

const updateProfileSchema = z.object({
    name: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
    avatar: z.string().url().optional().nullable(),
    oldPassword: z.string().optional(),
    newPassword: z.string()
        .min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
        .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير واحد على الأقل')
        .regex(/[0-9]/, 'يجب أن تحتوي على رقم واحد على الأقل')
        .optional(),
}).strict();

const forgotPasswordSchema = z.object({
    email: z.string().email('بريد إلكتروني غير صالح'),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'الرمز مطلوب'),
    newPassword: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
});

const validate = (schema, target = 'body') => (req, res, next) => {
    try {
        req[target] = schema.parse(req[target]);
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
    providerRequestSchema,
    updateProfileSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    validate
};
