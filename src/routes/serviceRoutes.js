const express = require('express');
const router = express.Router();
const { getAllServices, getServiceById, createService } = require('../controllers/serviceController');
const { protect } = require('../middleware/authMiddleware');

// Route for fetching all services
router.get('/', getAllServices);

// Route for fetching a specific service
router.get('/:id', getServiceById);

// CRITICAL FIX: Route for saving a new service (POST /api/services)
// Includes the 'protect' middleware so only authenticated users/admins can add services
router.post('/', protect, createService);

module.exports = router;