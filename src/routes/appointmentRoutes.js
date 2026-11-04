const router = require('express').Router();
const { 
  getUserAppointments, 
  createAppointment, 
  updateAppointmentStatus, 
  assignStaff,
  getBookedSlots 
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/booked-slots', protect, getBookedSlots);


router.get('/', protect, getUserAppointments);
router.post('/', protect, createAppointment);
router.patch('/:id/status', protect, updateAppointmentStatus);
router.patch('/:id/assign-staff', protect, assignStaff);

module.exports = router;