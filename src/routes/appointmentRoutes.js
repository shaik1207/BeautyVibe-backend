const router = require('express').Router();
const { 
  getUserAppointments, 
  createAppointment, 
  updateAppointmentStatus, 
  assignStaff,
  getBookedSlots 
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');

// Public route to allow slot checking during guest / unauthenticated booking flows
router.get('/booked-slots', getBookedSlots);

// Protected routes
router.get('/', protect, getUserAppointments);
router.post('/', protect, createAppointment);
router.patch('/:id/status', protect, updateAppointmentStatus);
router.patch('/:id/assign-staff', protect, assignStaff);

module.exports = router;