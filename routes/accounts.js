const express = require('express');
const { body, param } = require('express-validator');
const Account = require('../models/Account');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CooperativeBank = require('../models/CooperativeBank');
const { authenticateToken, authorizeRoles, authorizeUserAccess, authorizeBankAccess } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');

const router = express.Router();

// Create new account
router.post('/', authenticateToken, [
  body('accountType')
    .isIn(['savings', 'current', 'fixed_deposit', 'recurring_deposit'])
    .withMessage('Invalid account type'),
  body('minimumBalance')
    .optional()
    .isNumeric()
    .withMessage('Minimum balance must be a number')
    .isFloat({ min: 0 })
    .withMessage('Minimum balance cannot be negative'),
  body('interestRate')
    .optional()
    .isNumeric()
    .withMessage('Interest rate must be a number')
    .isFloat({ min: 0 })
    .withMessage('Interest rate cannot be negative'),
  body('nomineeDetails.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nominee name cannot be empty'),
  body('nomineeDetails.relationship')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nominee relationship cannot be empty'),
  body('nomineeDetails.phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('nomineeDetails.aadharNumber')
    .optional()
    .matches(/^[0-9]{12}$/)
    .withMessage('Please provide a valid 12-digit Aadhar number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { accountType, minimumBalance, interestRate, nomineeDetails } = req.body;

  // Check if user already has an account of this type
  const existingAccount = await Account.findOne({
    userId: req.user._id,
    accountType,
    isActive: true
  });

  if (existingAccount) {
    return errorResponse(res, 400, `You already have an active ${accountType} account`);
  }

  // Create new account
  const account = new Account({
    userId: req.user._id,
    cooperativeBankId: req.cooperativeBankId,
    accountType,
    minimumBalance: minimumBalance || (accountType === 'savings' ? 1000 : 0),
    interestRate: interestRate || (accountType === 'savings' ? 4.0 : 0),
    nomineeDetails
  });

  await account.save();

  successResponse(res, 201, 'Account created successfully', { account });
}));

// Get user's accounts
router.get('/my-accounts', authenticateToken, asyncHandler(async (req, res) => {
  const accounts = await Account.find({ 
    userId: req.user._id, 
    cooperativeBankId: req.cooperativeBankId,
    isActive: true 
  })
  .populate('cooperativeBankId', 'bankName bankCode')
  .sort({ createdAt: -1 });

  successResponse(res, 200, 'Accounts retrieved successfully', { accounts });
}));

// Get account by ID
router.get('/:accountId', authenticateToken, [
  param('accountId').isMongoId().withMessage('Invalid account ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const account = await Account.findById(req.params.accountId)
    .populate('cooperativeBankId', 'bankName bankCode');

  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager', 'super_admin'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  // Check if account belongs to the same cooperative bank (unless super admin)
  if (req.user.role !== 'super_admin' && 
      account.cooperativeBankId._id.toString() !== req.cooperativeBankId.toString()) {
    return errorResponse(res, 403, 'Access denied - account belongs to different cooperative bank');
  }

  successResponse(res, 200, 'Account retrieved successfully', { account });
}));

// Get account balance
router.get('/:accountId/balance', authenticateToken, [
  param('accountId').isMongoId().withMessage('Invalid account ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const account = await Account.findById(req.params.accountId);

  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  successResponse(res, 200, 'Balance retrieved successfully', {
    accountNumber: account.accountNumber,
    balance: account.balance,
    accountType: account.accountType,
    lastUpdated: account.updatedAt
  });
}));

// Update account details
router.put('/:accountId', authenticateToken, [
  param('accountId').isMongoId().withMessage('Invalid account ID'),
  body('nomineeDetails.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nominee name cannot be empty'),
  body('nomineeDetails.relationship')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nominee relationship cannot be empty'),
  body('nomineeDetails.phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('nomineeDetails.aadharNumber')
    .optional()
    .matches(/^[0-9]{12}$/)
    .withMessage('Please provide a valid 12-digit Aadhar number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const account = await Account.findById(req.params.accountId);

  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  const allowedUpdates = ['nomineeDetails'];
  const updates = {};

  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const updatedAccount = await Account.findByIdAndUpdate(
    req.params.accountId,
    updates,
    { new: true, runValidators: true }
  );

  successResponse(res, 200, 'Account updated successfully', { account: updatedAccount });
}));

// Deactivate account
router.put('/:accountId/deactivate', authenticateToken, [
  param('accountId').isMongoId().withMessage('Invalid account ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const account = await Account.findById(req.params.accountId);

  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  if (!account.isActive) {
    return errorResponse(res, 400, 'Account is already deactivated');
  }

  if (account.balance > 0) {
    return errorResponse(res, 400, 'Cannot deactivate account with remaining balance. Please withdraw all funds first.');
  }

  account.isActive = false;
  await account.save();

  successResponse(res, 200, 'Account deactivated successfully', { account });
}));

// Get all accounts (Admin/Manager only) - Bank scoped
router.get('/admin/all-accounts', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const accounts = await Account.find(filter)
    .populate('userId', 'firstName lastName email phone')
    .populate('cooperativeBankId', 'bankName bankCode')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Account.countDocuments(filter);

  successResponse(res, 200, 'Accounts retrieved successfully', {
    accounts,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get account statistics (Admin/Manager only) - Bank scoped
router.get('/admin/stats', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const totalAccounts = await Account.countDocuments(filter);
  const totalBalance = await Account.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$balance' } } }
  ]);

  const accountsByType = await Account.aggregate([
    { $match: filter },
    { $group: { _id: '$accountType', count: { $sum: 1 }, totalBalance: { $sum: '$balance' } } }
  ]);

  const newAccountsThisMonth = await Account.countDocuments({
    ...filter,
    createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
  });

  successResponse(res, 200, 'Account statistics retrieved successfully', {
    totalAccounts,
    totalBalance: totalBalance[0]?.total || 0,
    accountsByType,
    newAccountsThisMonth
  });
}));

module.exports = router;
