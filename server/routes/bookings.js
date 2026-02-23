const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/booking.controller');
const { verifyToken } = require('../middleware/auth');
const { globalLimiter } = require('../middleware/security');

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
// ALL ROUTES REQUIRE AUTH & RATE LIMITER
// =====================================
router.use(verifyToken);
router.use(globalLimiter);

// =====================================
// CHECKOUT & CREATION
// =====================================
router.post('/checkout', validate(checkoutSchema), bookingController.checkout);

// Legacy Simple Create kept for specific UI fallbacks
router.post('/', validate(createBookingSchema), bookingController.createLegacyBooking);

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

module.exports = router;
