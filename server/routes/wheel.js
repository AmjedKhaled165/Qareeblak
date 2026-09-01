const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../middleware/auth');
const { orderLimiter, globalLimiter } = require('../middleware/security');
const wheelController = require('../controllers/wheel.controller');
const { validatePrize, createPrizeSchema, updatePrizeSchema } = require('../validations/wheel.validation');

// ─── PUBLIC ──────────────────────────────────────────────────────────────────
router.get('/prizes', wheelController.getActivePrizes);

// ─── AUTHENTICATED ───────────────────────────────────────────────────────────
router.use(verifyToken);

// orderLimiter: max 3 spins/minute per user to prevent rapid-fire abuse
router.post('/spin', orderLimiter, wheelController.spin);
router.get('/my-prizes', wheelController.getMyPrizes);

// ─── ADMIN ───────────────────────────────────────────────────────────────────
router.use(isAdmin);

router.get('/admin/prizes', wheelController.getAllPrizes);
router.post('/admin/prizes', validatePrize(createPrizeSchema), wheelController.createPrize);
router.put('/admin/prizes/:id', validatePrize(updatePrizeSchema), wheelController.updatePrize);
router.delete('/admin/prizes/:id', wheelController.deletePrize);

module.exports = router;
