const wheelService = require('../services/wheel.service');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

/**
 * GET /api/wheel/prizes
 * Public — returns active prizes for the frontend wheel UI
 */
exports.getActivePrizes = catchAsync(async (req, res) => {
    const prizes = await wheelService.getActivePrizes();
    res.json(prizes);
});

/**
 * POST /api/wheel/spin
 * Authenticated — spins the wheel for the current user
 */
exports.spin = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const prize = await wheelService.spinWheel(userId);
    logger.info(`[Wheel] User ${userId} won: ${prize.name} (${prize.type})`);
    res.json({ success: true, prize });
});

/**
 * GET /api/wheel/my-prizes
 * Authenticated — returns user's unused prizes
 */
exports.getMyPrizes = catchAsync(async (req, res) => {
    const prizes = await wheelService.getUserPrizes(req.user.id);
    res.json(prizes);
});

// ─── ADMIN ──────────────────────────────────────────────────────────────────

/**
 * GET /api/wheel/admin/prizes
 * Admin — all prizes including inactive
 */
exports.getAllPrizes = catchAsync(async (req, res) => {
    const prizes = await wheelService.getAllPrizes();
    res.json(prizes);
});

/**
 * POST /api/wheel/admin/prizes
 * Admin — create new prize
 */
exports.createPrize = catchAsync(async (req, res) => {
    const prize = await wheelService.createPrize(req.body);
    res.status(201).json(prize);
});

/**
 * PUT /api/wheel/admin/prizes/:id
 * Admin — update prize
 */
exports.updatePrize = catchAsync(async (req, res) => {
    const prize = await wheelService.updatePrize(req.params.id, req.body);
    res.json(prize);
});

/**
 * DELETE /api/wheel/admin/prizes/:id
 * Admin — delete prize
 */
exports.deletePrize = catchAsync(async (req, res) => {
    await wheelService.deletePrize(req.params.id);
    res.json({ success: true });
});
