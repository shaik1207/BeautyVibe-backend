const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Built-in Node module for generating random passwords
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret_key', {
    expiresIn: '30d',
  });
};

// 1. Register / Google Auth Handler
const googleOrRegisterAuth = async (req, res) => {
  try {
    console.log("[Auth] Incoming Google Login Request:", req.body);

    // Safety check: Ensure Express is parsing the JSON body correctly
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Request body is empty. Check express.json() middleware.' 
      });
    }

    const { name, email, phone, idToken } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required from Google.' 
      });
    }

    // Check if user already exists
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // CRITICAL FIX: Generate a random secure password for Google users
      // This prevents Sequelize from crashing if the 'password' column is required
      const randomPassword = crypto.randomBytes(16).toString('hex');

      user = await User.create({
        name: name || email.split('@')[0],
        email: email,
        password: randomPassword, // Bypasses the missing password validation error
        phone: phone || '+91 00000 00000',
        role: 'user',
        authProvider: idToken ? 'google' : 'local',
        firebaseUid: idToken ? 'verified_firebase_user' : null,
      });
      
      console.log(`[Auth] New Google user created: ${email}`);
    }

    const token = generateToken(user.id);
    
    return res.status(200).json({
      success: true,
      token,
      data: user,
    });

  } catch (error) {
    console.error("[Auth] Google Login Error:", error);
    // Return 400 with the exact error message so the frontend can read it
    return res.status(400).json({ success: false, message: error.message });
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

// EXPORT ALL FUNCTIONS
module.exports = {
  googleOrRegisterAuth,
  loginUser,
  getMe,
};