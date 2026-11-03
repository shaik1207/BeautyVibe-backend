const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ==========================================
// 1. SYNC FIREBASE / GOOGLE USER
// ==========================================
exports.syncUser = async (req, res, next) => {
  try {
    const { uid, email, name, picture } = req.user;
    const requestedSalon = String(req.body.salonId || 'salon-101').trim();
    const formattedEmail = (email || '').toLowerCase();
    const fullName = name || 'BeautyVibe User';
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'User';
    const lastName = parts.slice(1).join(' ') || '';

    // Step 1: Try finding existing user by firebaseUid
    let user = await User.findOne({ where: { firebaseUid: uid } });

    // Step 2: If not found by firebaseUid, check by email (links existing local accounts to Google login)
    if (!user && formattedEmail) {
      user = await User.findOne({ where: { email: formattedEmail } });
      if (user) {
        user.firebaseUid = uid;
        if (picture && !user.avatar) user.avatar = picture;
        if (!user.firstName && firstName) user.firstName = firstName;
        if (!user.lastName && lastName) user.lastName = lastName;
        await user.save();
      }
    }

    // Step 3: If still not found, create a new user profile
    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        email: formattedEmail,
        firstName,
        lastName,
        name: fullName,
        avatar: picture || '',
        role: 'admin', // Ensures synced profiles get full management access
        status: 'Active'
      });
    }

    // Generate local session JWT token
    const token = jwt.sign(
      { id: user.id }, 
      process.env.JWT_SECRET || 'your_jwt_secret_key', 
      { expiresIn: '30d' }
    );

    return res.status(200).json({ 
      success: true, 
      token,
      data: user 
    });
  } catch (e) {
    next(e);
  }
};

// ==========================================
// 2. GET USER PROFILE
// ==========================================
exports.getProfile = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. UPDATE USER PROFILE
// ==========================================
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName !== undefined ? req.body.lastName : user.lastName;
    user.name = req.body.name || `${user.firstName} ${user.lastName}`.trim();
    user.email = req.body.email || user.email;
    user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;

    await user.save();

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. DOORSTEP ADDRESSES MANAGEMENT
// ==========================================
exports.getAddresses = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, addresses: req.user.addresses || [] });
  } catch (error) {
    next(error);
  }
};

exports.addAddress = async (req, res, next) => {
  try {
    const {
      label,
      houseNo,
      street,
      area,
      city,
      state,
      pincode,
      landmark,
      fullAddress,
      coordinates
    } = req.body;

    if (!fullAddress && !city) {
      return res.status(400).json({ success: false, message: 'Full address or city is required' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentAddresses = Array.isArray(user.addresses) ? user.addresses : [];
    const isDefault = currentAddresses.length === 0;

    const newAddress = {
      id: Date.now().toString(),
      label: label || 'Home',
      houseNo: houseNo || '',
      street: street || '',
      area: area || '',
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      landmark: landmark || '',
      fullAddress: fullAddress || `${houseNo || ''} ${street || ''}, ${city || ''}`.trim(),
      coordinates: coordinates || null,
      isDefault
    };

    // Immutable array reassign to trigger Sequelize JSON dirty checking
    user.addresses = [...currentAddresses, newAddress];
    await user.save();

    return res.status(201).json({
      success: true,
      addresses: user.addresses,
      message: 'Address saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentAddresses = Array.isArray(user.addresses) ? user.addresses : [];
    
    user.addresses = currentAddresses.filter(
      (addr) => String(addr.id || addr._id) !== String(req.params.id)
    );
    await user.save();

    return res.status(200).json({
      success: true,
      addresses: user.addresses,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. PAYMENT METHODS MANAGEMENT
// ==========================================
exports.getPayments = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, payments: req.user.payments || [] });
  } catch (error) {
    next(error);
  }
};

exports.addPayment = async (req, res, next) => {
  try {
    const { type, identifier, number, holder, expiry, cvv } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentPayments = Array.isArray(user.payments) ? user.payments : [];

    const newPayment = {
      id: Date.now().toString(),
      type: type || 'UPI',
      identifier: identifier || '',
      number: number ? `**** **** **** ${String(number).slice(-4)}` : '',
      holder: holder || '',
      expiry: expiry || '',
      cvv: cvv ? '***' : ''
    };

    user.payments = [...currentPayments, newPayment];
    await user.save();

    return res.status(201).json({
      success: true,
      payments: user.payments,
      message: 'Payment method saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.deletePayment = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentPayments = Array.isArray(user.payments) ? user.payments : [];

    user.payments = currentPayments.filter(
      (pay) => String(pay.id || pay._id) !== String(req.params.id)
    );
    await user.save();

    return res.status(200).json({
      success: true,
      payments: user.payments,
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. LOGOUT
// ==========================================
exports.logout = async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};