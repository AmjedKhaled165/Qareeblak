const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/booking.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { checkoutLimiter } = require('../middleware/security');

const {
    checkoutSchema,
    createBookingSchema,
    updateStatusSchema,
    rescheduleSchema,
    acceptAppointmentSchema,
    getBookingsQuerySchema,
    validateIdParam,
    validate
} = require('../validations/booking.validation');

// =====================================
// ALL ROUTES REQUIRE AUTH
// =====================================
router.use(verifyToken);
// NOTE: globalLimiter is already applied globally in middleware/config.js on all /api/* routes.
// Applying it again here would double-count limits. Removed to prevent users being rate-limited 2x faster.

// =====================================
// ADMIN: GET ALL BOOKINGS (Paginated)
// =====================================
// Admin-only endpoint - returns all platform bookings with cursor-based pagination
router.get('/', isAdmin, bookingController.getAllBookings);

// =====================================
// CHECKOUT & CREATION
// =====================================
router.post('/checkout', checkoutLimiter, validate(checkoutSchema), bookingController.checkout);

// Legacy Simple Create kept for specific UI fallbacks
router.post('/', checkoutLimiter, validate(createBookingSchema), bookingController.createLegacyBooking);

// =====================================
// FETCHING (With Pagination)
// =====================================
// Get bookings by provider (IDOR Protected inside Controller)
router.get('/provider/:providerId', validate(getBookingsQuerySchema, 'query'), bookingController.getProviderBookings);

// Get bookings by user (IDOR Protected inside Controller)
router.get('/user/:userId', validate(getBookingsQuerySchema, 'query'), bookingController.getUserBookings);

// Allow specific booking fetch id params
router.get('/:id', bookingController.getBookingById);

// =====================================
// OPERATIONS
// =====================================
// Update Status (Provider -> User sync)
router.patch('/:id/status', validate(validateIdParam, 'params'), validate(updateStatusSchema), bookingController.updateStatus);

// Reschedule Appointment Negotiation
router.patch('/:id/reschedule', validate(validateIdParam, 'params'), validate(rescheduleSchema), bookingController.rescheduleAppointment);

// Confirm Appointment Negotiation
router.patch('/:id/accept-appointment', validate(validateIdParam, 'params'), validate(acceptAppointmentSchema), bookingController.acceptAppointment);

// 🚀 [Product Magic] One-Click Reorder
router.post('/:id/reorder', validate(validateIdParam, 'params'), bookingController.reorder);

module.exports = router;
