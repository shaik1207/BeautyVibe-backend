const express = require('express');
const router = express.Router();
const { getFinancials } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/payments - Fetch dashboard revenue and transactions
router.get('/', protect, getFinancials);

module.exports = router;