const express = require('express');
const router = express.Router();
const { verifyToken, isPartnerOrAdmin } = require('../middleware/auth');
const productController = require('../controllers/halan_product.controller');

router.use(verifyToken);
router.use(isPartnerOrAdmin);

router.get('/', productController.getAll);
router.post('/', productController.create);
router.delete('/:id', productController.delete);

module.exports = router;
