const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Attach user from database to request
      req.user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found for this token.' });
      }

      return next();
    } catch (error) {
      console.error("Token verification failed:", error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
  }
};

module.exports = { protect, admin };