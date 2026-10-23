const express = require('express');
const router = express.Router();

// Import all controller functions explicitly
const {
  registerUser,
  googleAuth,
  loginUser,
  getMe,
} = require('../controllers/authController');

// Optional: Import your authentication middleware if you have one for protected routes
// const { protect } = require('../middleware/authMiddleware');

// Define routes
router.post('/register', registerUser);
router.post('/google', googleAuth);
router.post('/login', loginUser);

// For '/me', ensure you have a 'protect' middleware. If not, remove 'protect'.
// router.get('/me', protect, getMe);
router.get('/me', getMe);

module.exports = router;