const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check if authorization header exists and starts with Bearer
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token missing.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

    // Fetch user from database and attach to request
    req.user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] } // Never attach password to req.user
    });

    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user no longer exists.' 
      });
    }

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, token failed or expired.' 
    });
  }
};

// Optional: Admin-only guard middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin role required.' 
    });
  }
};

module.exports = { protect, adminOnly };