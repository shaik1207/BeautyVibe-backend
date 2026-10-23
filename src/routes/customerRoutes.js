const express = require('express');
const router = express.Router();
const { 
  getCustomers, 
  upsertCustomer, 
  updateCustomerStatus, 
  deleteCustomer 
} = require('../controllers/customerController');

router.get('/', getCustomers);
router.post('/', upsertCustomer);
router.patch('/:id/status', updateCustomerStatus);
router.delete('/:id', deleteCustomer);

module.exports = router;