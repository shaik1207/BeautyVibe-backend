const express = require('express');
const router = express.Router();
const { 
  getUserAppointments, 
  createAppointment, 
  updateAppointmentStatus, 
  assignStaff 
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getUserAppointments);
router.post('/', protect, createAppointment);
router.patch('/:id/status', protect, updateAppointmentStatus);
router.patch('/:id/assign-staff', protect, assignStaff);

module.exports = router;