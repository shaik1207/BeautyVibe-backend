const jwt = require('jsonwebtoken');
const User = require('../models/User');

// --------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// --------------------------------------------------
const protect = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token missing.' 
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      console.error("[AUTH ERROR] JWT_SECRET is missing in environment variables!");
    }

    // Verify token
    const decoded = jwt.verify(token, secret || 'your_jwt_secret_key');

    if (!decoded || !decoded.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, invalid token payload.' 
      });
    }

    // Fetch user from database excluding password
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user no longer exists.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.message);
    
    const message = error.name === 'TokenExpiredError' 
      ? 'Not authorized, token expired.' 
      : 'Not authorized, token failed.';

    return res.status(401).json({ 
      success: false, 
      message 
    });
  }
};

// --------------------------------------------------
// ADMIN AUTHORIZATION MIDDLEWARE
// --------------------------------------------------
const adminOnly = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase().trim();

  if (role === 'admin' || role === 'superadmin') {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Administrator role required.' 
  });
};

module.exports = { 
  protect, 
  adminOnly 
};