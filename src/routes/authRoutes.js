const express = require('express');
const router = express.Router();
const {
  registerUser,
  googleAuth,
  loginUser,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/google', googleAuth);
router.post('/login', loginUser);

// Protected route: requires valid Bearer token
router.get('/me', protect, getMe);

module.exports = router;