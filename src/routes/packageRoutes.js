const express = require('express');
const router = express.Router();
const { 
  getPackages, 
  createPackage, 
  updatePackage, 
  deletePackage 
} = require('../controllers/packageController');

router.route('/')
  .get(getPackages)
  .post(createPackage);

router.route('/:id')
  .put(updatePackage)
  .delete(deletePackage);

module.exports = router;