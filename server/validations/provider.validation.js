const { z } = require('zod');

const addReviewSchema = z.object({
    userName: z.string().optional().default('مجهول'),
    rating: z.number().min(1).max(5, 'التقييم يجب أن يكون بين 1 و 5'),
    comment: z.string().optional()
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
    addReviewSchema,
    validate
};
