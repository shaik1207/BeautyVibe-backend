const express = require('express');
const router = express.Router();
const { 
  getStaff, 
  createStaff, 
  updateStaff, 
  deleteStaff 
} = require('../controllers/staffController');

router.route('/')
  .get(getStaff)
  .post(createStaff);

router.route('/:id')
  .put(updateStaff)
  .patch(updateStaff)
  .delete(deleteStaff);

module.exports = router;