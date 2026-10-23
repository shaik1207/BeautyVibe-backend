const express = require('express');
const router = express.Router();
const { getStaff, createStaff, deleteStaff } = require('../controllers/staffController');

router.route('/')
  .get(getStaff)
  .post(createStaff);

router.route('/:id')
  .delete(deleteStaff);

module.exports = router;