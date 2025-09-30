const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CooperativeBank = require('../models/CooperativeBank');

// Generate JWT token
const generateToken = (userId, cooperativeBankId = null) => {
  const payload = { userId };
  if (cooperativeBankId) {
    payload.cooperativeBankId = cooperativeBankId;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .populate('cooperativeBankId', 'bankName bankCode status isActive')
      .select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if cooperative bank is active (except for super_admin)
    if (user.role !== 'super_admin' && user.cooperativeBankId && !user.cooperativeBankId.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cooperative bank is deactivated'
      });
    }

    req.user = user;
    req.cooperativeBankId = user.cooperativeBankId?._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

// Role-based authorization middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check if user can access their own data or is admin
const authorizeUserAccess = (req, res, next) => {
  const userId = req.params.userId || req.params.id;
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin can access any user's data
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Admin and managers can access users from their cooperative bank
  if (['admin', 'manager'].includes(req.user.role)) {
    return next();
  }

  // Users can only access their own data
  if (req.user._id.toString() === userId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied - you can only access your own data'
  });
};

// Check if user belongs to the same cooperative bank
const authorizeBankAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Super admin can access any bank's data
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Check if user belongs to the cooperative bank
  const bankId = req.params.bankId || req.cooperativeBankId;
  
  if (!bankId) {
    return res.status(400).json({
      success: false,
      message: 'Cooperative bank context required'
    });
  }

  if (req.user.cooperativeBankId && req.user.cooperativeBankId.toString() === bankId.toString()) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied - you can only access your cooperative bank data'
  });
};

// Switch cooperative bank context (for super admin)
const switchBankContext = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only super admin can switch bank context'
    });
  }

  const bankId = req.headers['x-bank-id'] || req.body.bankId;
  
  if (bankId) {
    req.cooperativeBankId = bankId;
  }

  next();
};

module.exports = {
  generateToken,
  authenticateToken,
  authorizeRoles,
  authorizeUserAccess,
  authorizeBankAccess,
  switchBankContext
};
