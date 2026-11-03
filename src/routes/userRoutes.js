const router = require('express').Router();
const { protect } = require('../middleware/authenticate');
const c = require('../controllers/userController');

// ==========================================
// 1. FIREBASE SYNC ROUTE
// ==========================================
router.post('/sync', async (req, res, next) => {
  try {
    const admin = require('../config/firebase');
    const h = req.headers.authorization || '';
    
    // Bulletproof check to prevent "Cannot read properties of undefined (reading 'length')" errors
    if (!h.startsWith('Bearer ') || !admin || !admin.apps || admin.apps.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Valid Firebase token required.' 
      });
    }

    req.user = await admin.auth().verifyIdToken(h.slice(7), true);
    next();
  } catch (e) {
    console.error("Firebase Sync Token Error:", e.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
}, c.syncUser);

// ==========================================
// 2. PROFILE & SETTINGS ROUTES
// ==========================================
router.get('/me', protect, c.getProfile);
router.get('/profile', protect, c.getProfile);
router.put('/profile', protect, c.updateProfile);

// ==========================================
// 3. DOORSTEP ADDRESSES ROUTES
// ==========================================
router.get('/addresses', protect, c.getAddresses);
router.post('/addresses', protect, c.addAddress);
router.delete('/addresses/:id', protect, c.deleteAddress);

// ==========================================
// 4. PAYMENT METHODS ROUTES
// ==========================================
router.get('/payments', protect, c.getPayments);
router.post('/payments', protect, c.addPayment);
router.delete('/payments/:id', protect, c.deletePayment);

// ==========================================
// 5. LOGOUT ROUTE
// ==========================================
router.post('/logout', protect, c.logout);

module.exports = router;