// Chat Routes - Refactored for Enterprise Architecture
const express = require('express');
const router = express.Router();

// Middleware
const { verifyToken } = require('../middleware/auth');
const upload = require('../config/multer');
const { globalLimiter } = require('../middleware/security');

// Controllers
const chatController = require('../controllers/chat.controller');

// Validations
const {
    startConsultationSchema,
    sendMessageSchema,
    sendQuoteSchema,
    acceptQuoteSchema,
    validateParams,
    validate
} = require('../validations/chat.validation');

// All routes require Auth Verification and Basic Rate Limiting
router.use(verifyToken);
router.use(globalLimiter);

// Start or Retrieve Consultation
router.post('/start', validate(startConsultationSchema), chatController.startConsultation);

// Provider specific consultations dashboard
router.get('/dashboard/:providerId', chatController.getProviderConsultations);

// Get Messages (With Pagination parameter handling)
router.get('/:consultationId', validate(validateParams, 'params'), chatController.getMessages);

// Send Standard Message
router.post('/:consultationId/messages', validate(validateParams, 'params'), validate(sendMessageSchema), chatController.sendMessage);

// Upload Image Message (Validations done via multer config directly)
router.post('/:consultationId/upload', validate(validateParams, 'params'), upload.single('image'), chatController.uploadImage);

// Mark Messages As Read
router.put('/:consultationId/read', validate(validateParams, 'params'), chatController.markAsRead);

// Order Quote Feature (Pharmacist to Customer)
router.post('/:consultationId/quote', validate(validateParams, 'params'), validate(sendQuoteSchema), chatController.sendQuote);

// Accept Order Quote (Customer)
router.post('/:consultationId/accept-quote', validate(validateParams, 'params'), validate(acceptQuoteSchema), chatController.acceptQuote);

module.exports = router;
