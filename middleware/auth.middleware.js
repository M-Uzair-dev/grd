const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Partner = require('../models/partner.model');

// Protect routes - verify token and attach user/partner to request
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user based on role
      if (decoded.role === 'admin') {
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
          return res.status(401).json({ message: 'Admin not found' });
        }
        req.user = user;
        req.role = 'admin';
      } else if (decoded.role === 'partner') {
        const partner = await Partner.findById(decoded.id).select('-password');
        if (!partner) {
          return res.status(401).json({ message: 'Partner not found' });
        }
        req.user = partner;
        req.role = 'partner';
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Restrict to admin only
exports.adminOnly = (req, res, next) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ message: 'This route is restricted to admin users' });
  }
  next();
};

// Restrict to partner only
exports.partnerOnly = (req, res, next) => {
  if (req.role !== 'partner') {
    return res.status(403).json({ message: 'This route is restricted to partner users' });
  }
  next();
}; 