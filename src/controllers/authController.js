const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret_key', {
    expiresIn: '30d',
  });
};

// Helper to remove password hashes from user objects before sending responses
const sanitizeUser = (user) => {
  const userJson = user.toJSON ? user.toJSON() : user;
  delete userJson.password;
  return userJson;
};

// 1. Standard Register Handler (For Admin / Local Signup)
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email.' });
    }

    // The User model hook will automatically hash this password securely
    const user = await User.create({
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      password,
      phone: phone || null,
      role: role || 'user',
      authProvider: 'local'
    });

    const token = generateToken(user.id);
    return res.status(201).json({
      success: true,
      token,
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Google Auth / Register Handler
const googleAuth = async (req, res) => {
  try {
    const { name, email, phone, token, idToken, firebaseUid, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required from Google.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      // Create new user for Google sign-in
      user = await User.create({
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: null, // Google users do not require passwords
        phone: phone || null,
        role: 'user',
        authProvider: 'google',
        firebaseUid: firebaseUid || null, // Unique Firebase UID or null (MySQL allows multiple nulls)
        avatar: avatar || null,
      });
    } else {
      // Update existing user's provider / details if logging in via Google
      let isUpdated = false;
      if (user.authProvider !== 'google') {
        user.authProvider = 'google';
        isUpdated = true;
      }
      if (firebaseUid && !user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        isUpdated = true;
      }
      if (avatar && !user.avatar) {
        user.avatar = avatar;
        isUpdated = true;
      }
      if (isUpdated) {
        await user.save();
      }
    }

    const jwtToken = generateToken(user.id);
    return res.status(200).json({
      success: true,
      token: jwtToken,
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// 3. Standard Login Handler
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: normalizedEmail } });

    // Check if user exists, has a password, and password matches
    if (!user || !user.password || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = generateToken(user.id);
    return res.status(200).json({
      success: true,
      token,
      data: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Session Profile Handler
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }
    return res.status(200).json({ success: true, data: sanitizeUser(req.user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  googleAuth,
  loginUser,
  getMe,
};