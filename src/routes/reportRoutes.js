const express = require('express');
const router = express.Router();
const { getReportAnalytics } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/reports - Fetch all business analytics and charts
router.get('/', protect, getReportAnalytics);

module.exports = router;