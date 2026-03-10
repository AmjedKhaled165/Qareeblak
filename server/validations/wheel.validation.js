const { z } = require('zod');

const prizeSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    prize_type: z.enum(['discount', 'free_service', 'money', 'no_prize']),
    prize_value: z.number().nonnegative().max(10000),
    provider_id: z.number().int().positive().nullable().optional(),
    // probability 1–100 prevents a single prize from monopolizing the wheel
    probability: z.number().int().min(1).max(100),
    // Strictly validate hex color — prevents XSS via color field rendered in frontend
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex e.g. #FF5733'),
    is_active: z.boolean().optional()
});

const createPrizeSchema = prizeSchema.omit({ is_active: true });
const updatePrizeSchema = prizeSchema;

function validatePrize(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            return res.status(400).json({ error: 'بيانات الجائزة غير صالحة', details: errors });
        }
        req.body = result.data;
        next();
    };
}

module.exports = { validatePrize, createPrizeSchema, updatePrizeSchema };
