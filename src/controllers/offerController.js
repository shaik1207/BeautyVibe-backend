const Offer = require('../models/Offer');
const { Op } = require('sequelize');

// Get all offers (automatically update status if expired)
exports.getOffers = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Auto-update expired offers in database
    await Offer.update(
      { status: 'Expired' },
      { 
        where: { 
          expiryDate: { [Op.lt]: today },
          status: 'Active'
        } 
      }
    );

    const offers = await Offer.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, data: offers });
  } catch (error) {
    console.error("Get Offers Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new offer
exports.createOffer = async (req, res) => {
  try {
    const { code, discount, type, expiryDate } = req.body;

    if (!code || !discount || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Required coupon fields are missing.' });
    }

    const today = new Date().toISOString().split('T')[0];
    const status = expiryDate < today ? 'Expired' : 'Active';

    // Format readable expiry date string
    const formattedExpiry = new Date(expiryDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const newOffer = await Offer.create({
      code: code.toUpperCase(),
      discount,
      type,
      expiryDate,
      expiry: formattedExpiry,
      usage: '0 redemptions',
      status
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('offerUpdated', newOffer);
    }

    res.status(201).json({ success: true, data: newOffer });
  } catch (error) {
    console.error("Create Offer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete an offer
exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findByPk(id);

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    await offer.destroy();

    const io = req.app.get('io');
    if (io) {
      io.emit('offerDeleted', id);
    }

    res.status(200).json({ success: true, message: 'Coupon deleted successfully.' });
  } catch (error) {
    console.error("Delete Offer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete all expired offers
exports.deleteExpiredOffers = async (req, res) => {
  try {
    await Offer.destroy({ where: { status: 'Expired' } });

    const io = req.app.get('io');
    if (io) {
      io.emit('expiredOffersCleared', true);
    }

    res.status(200).json({ success: true, message: 'All expired coupons cleaned up successfully.' });
  } catch (error) {
    console.error("Bulk Delete Expired Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};