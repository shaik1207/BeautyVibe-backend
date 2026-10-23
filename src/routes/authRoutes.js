const express = require('express');
const router = express.Router();

// Destructure the exact exported function names from authController
const { 
  googleOrRegisterAuth, 
  loginUser, 
  getMe 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Define routes (none of these can be undefined)
router.post('/register', googleOrRegisterAuth);
router.post('/google', googleOrRegisterAuth);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

module.exports = router;