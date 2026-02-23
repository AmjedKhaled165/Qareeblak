const { z } = require('zod');

const assignCourierSchema = z.object({
    userId: z.number().int().positive(),
    supervisorId: z.number().int().positive(),
    action: z.enum(['add', 'remove'])
});

const updateAvailabilitySchema = z.object({
    isAvailable: z.boolean()
});

const updateProfileSchema = z.object({
    name_ar: z.string().optional(),
    username: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    avatar: z.string().optional().nullable(),
    oldPassword: z.string().optional(),
    newPassword: z.string().min(6).optional()
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
    assignCourierSchema,
    updateAvailabilitySchema,
    updateProfileSchema,
    validate
};
