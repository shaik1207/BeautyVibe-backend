const User = require('../models/User');

exports.syncUser = async (req, res, next) => {
  try {
    const { uid, email, name, picture } = req.user;
    const requestedSalon = String(req.body.salonId || 'salon-101').trim();
    
    let user = await User.findOne({ firebaseUid: uid });
    if (user) {
      return res.status(200).json({ success: true, data: user });
    }

    user = await User.create({
      firebaseUid: uid,
      email: (email || '').toLowerCase(),
      name: name || 'BeautyVibe User',
      avatar: picture || '',
      role: 'admin', // Ensure new synced profiles get full access to manage salon data
      salonId: requestedSalon
    });

    return res.status(200).json({ success: true, data: user });
  } catch (e) {
    next(e);
  }
};