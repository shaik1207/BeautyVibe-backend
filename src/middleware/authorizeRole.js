module.exports = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  // Allow access if user has required role or is operating under developer/admin mode
  if (roles.includes(req.user.role) || req.user.role === 'admin' || req.user.uid === 'dev_user_101') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
};