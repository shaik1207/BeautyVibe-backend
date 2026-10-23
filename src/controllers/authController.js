const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret_key', {
    expiresIn: '30d',
  });
};

// 1. Register / Google Auth Handler
const googleOrRegisterAuth = async (req, res) => {
  try {
    const { name, email, phone, idToken } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        phone: phone || '+91 98765 43210',
        role: 'user',
        authProvider: idToken ? 'google' : 'local',
        firebaseUid: idToken ? 'verified_firebase_user' : null,
      });
    }

    const token = generateToken(user.id);
    return res.status(200).json({
      success: true,
      token,
      data: user,
    });
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Standard Login Handler
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user.id);
    return res.status(200).json({
      success: true,
      token,
      data: user,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get Session Profile Handler
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }
    return res.status(200).json({ success: true, data: req.user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// EXPORT ALL FUNCTIONS AS AN OBJECT
module.exports = {
  googleOrRegisterAuth,
  loginUser,
  getMe,
};