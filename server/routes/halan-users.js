const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userController = require('../controllers/halan_user.controller');
const {
    validate,
    assignCourierSchema,
    updateAvailabilitySchema,
    updateProfileSchema
} = require('../validations/halan_user.validation');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

const authenticatePartner = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'غير مصرح' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'التوكن غير صالح' });
    }
};

router.use(authenticatePartner);

router.get('/', userController.getUsers);
router.get('/:id', userController.getUser);
router.post('/assign', validate(assignCourierSchema), userController.assignCourier);
router.patch('/:id/availability', validate(updateAvailabilitySchema), userController.updateAvailability);
router.put('/:id', validate(updateProfileSchema), userController.updateProfile);
router.delete('/:id', userController.deleteUser);

module.exports = router;
