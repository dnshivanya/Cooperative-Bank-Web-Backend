const express = require('express');
const { body, param } = require('express-validator');
const User = require('../models/User');
const Account = require('../models/Account');
const { authenticateToken, authorizeRoles, authorizeUserAccess, authorizeBankAccess } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');

const router = express.Router();

// Get all users (Admin/Manager only) - Bank scoped
router.get('/', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const users = await User.find(filter)
    .populate('cooperativeBankId', 'bankName bankCode')
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(filter);

  successResponse(res, 200, 'Users retrieved successfully', {
    users,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get user by ID - Bank scoped
router.get('/:userId', authenticateToken, authorizeUserAccess, [
  param('userId').isMongoId().withMessage('Invalid user ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .populate('cooperativeBankId', 'bankName bankCode')
    .select('-password');
  
  if (!user) {
    return errorResponse(res, 404, 'User not found');
  }

  // Check if user belongs to the same cooperative bank (unless super admin)
  if (req.user.role !== 'super_admin' && 
      user.cooperativeBankId._id.toString() !== req.cooperativeBankId.toString()) {
    return errorResponse(res, 403, 'Access denied - user belongs to different cooperative bank');
  }

  // Get user's accounts
  const accounts = await Account.find({ userId: user._id, isActive: true });

  successResponse(res, 200, 'User retrieved successfully', {
    user,
    accounts
  });
}));

// Update user status (Admin/Manager only) - Bank scoped
router.put('/:userId/status', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const { userId } = req.params;

  const filter = { _id: userId };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const user = await User.findOneAndUpdate(
    filter,
    { isActive },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return errorResponse(res, 404, 'User not found');
  }

  // If deactivating user, also deactivate their accounts
  if (!isActive) {
    await Account.updateMany(
      { userId },
      { isActive: false }
    );
  }

  successResponse(res, 200, `User ${isActive ? 'activated' : 'deactivated'} successfully`, { user });
}));

// Update user role (Admin only) - Bank scoped
router.put('/:userId/role', authenticateToken, authorizeRoles('admin'), authorizeBankAccess, [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('role').isIn(['member', 'admin', 'manager']).withMessage('Invalid role')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { role } = req.body;
  const { userId } = req.params;

  // Prevent admin from changing their own role
  if (req.user._id.toString() === userId && role !== 'admin') {
    return errorResponse(res, 400, 'Cannot change your own role');
  }

  const filter = { _id: userId };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const user = await User.findOneAndUpdate(
    filter,
    { role },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return errorResponse(res, 404, 'User not found');
  }

  successResponse(res, 200, 'User role updated successfully', { user });
}));

// Search users (Admin/Manager only) - Bank scoped
router.get('/search/users', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  
  if (!q) {
    return errorResponse(res, 400, 'Search query is required');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const searchRegex = new RegExp(q, 'i');
  const filter = {
    $and: [
      { isActive: true },
      {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { aadharNumber: searchRegex },
          { panNumber: searchRegex }
        ]
      }
    ]
  };

  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.$and.push({ cooperativeBankId: req.cooperativeBankId });
  }

  const users = await User.find(filter)
    .populate('cooperativeBankId', 'bankName bankCode')
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);

  successResponse(res, 200, 'Search completed successfully', {
    users,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    }
  });
}));

// Get user statistics (Admin/Manager only) - Bank scoped
router.get('/stats/overview', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const totalUsers = await User.countDocuments(filter);
  const totalAccounts = await Account.countDocuments({ isActive: true });
  const newUsersThisMonth = await User.countDocuments({
    ...filter,
    createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
  });

  const usersByRole = await User.aggregate([
    { $match: filter },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  successResponse(res, 200, 'Statistics retrieved successfully', {
    totalUsers,
    totalAccounts,
    newUsersThisMonth,
    usersByRole
  });
}));

module.exports = router;
