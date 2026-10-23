const express = require('express');
const router = express.Router();
const { 
  getOffers, 
  createOffer, 
  deleteOffer, 
  deleteExpiredOffers 
} = require('../controllers/offerController');

router.route('/')
  .get(getOffers)
  .post(createOffer);

router.delete('/expired', deleteExpiredOffers);

router.route('/:id')
  .delete(deleteOffer);

module.exports = router;