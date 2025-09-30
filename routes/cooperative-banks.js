const express = require('express');
const { body, param } = require('express-validator');
const CooperativeBank = require('../models/CooperativeBank');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');

const router = express.Router();

// Create new cooperative bank (Super Admin only)
router.post('/', authenticateToken, authorizeRoles('super_admin'), [
  body('bankName')
    .trim()
    .notEmpty()
    .withMessage('Bank name is required')
    .isLength({ max: 100 })
    .withMessage('Bank name cannot exceed 100 characters'),
  body('shortName')
    .trim()
    .notEmpty()
    .withMessage('Short name is required')
    .isLength({ max: 20 })
    .withMessage('Short name cannot exceed 20 characters'),
  body('registrationNumber')
    .trim()
    .notEmpty()
    .withMessage('Registration number is required'),
  body('licenseNumber')
    .trim()
    .notEmpty()
    .withMessage('License number is required'),
  body('establishedDate')
    .isISO8601()
    .withMessage('Please provide a valid established date'),
  body('address.street')
    .notEmpty()
    .withMessage('Street address is required'),
  body('address.city')
    .notEmpty()
    .withMessage('City is required'),
  body('address.state')
    .notEmpty()
    .withMessage('State is required'),
  body('address.pincode')
    .matches(/^[0-9]{6}$/)
    .withMessage('Please provide a valid 6-digit pincode'),
  body('contactDetails.phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('contactDetails.email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('bankingDetails.ifscCode')
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Please provide a valid IFSC code'),
  body('bankingDetails.micrCode')
    .matches(/^[0-9]{9}$/)
    .withMessage('Please provide a valid 9-digit MICR code'),
  body('financialDetails.authorizedCapital')
    .isNumeric()
    .withMessage('Authorized capital must be a number')
    .isFloat({ min: 0 })
    .withMessage('Authorized capital cannot be negative'),
  body('financialDetails.paidUpCapital')
    .isNumeric()
    .withMessage('Paid up capital must be a number')
    .isFloat({ min: 0 })
    .withMessage('Paid up capital cannot be negative')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const bankData = req.body;
  bankData.createdBy = req.user._id;

  // Check if bank with same registration or license number exists
  const existingBank = await CooperativeBank.findOne({
    $or: [
      { registrationNumber: bankData.registrationNumber },
      { licenseNumber: bankData.licenseNumber }
    ]
  });

  if (existingBank) {
    return errorResponse(res, 400, 'Bank with this registration or license number already exists');
  }

  const bank = new CooperativeBank(bankData);
  await bank.save();

  successResponse(res, 201, 'Cooperative bank created successfully', { bank });
}));

// Get all cooperative banks (Super Admin only)
router.get('/', authenticateToken, authorizeRoles('super_admin'), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const status = req.query.status;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  const banks = await CooperativeBank.find(filter)
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await CooperativeBank.countDocuments(filter);

  successResponse(res, 200, 'Cooperative banks retrieved successfully', {
    banks,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get cooperative bank by ID
router.get('/:bankId', authenticateToken, [
  param('bankId').isMongoId().withMessage('Invalid bank ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const bank = await CooperativeBank.findById(req.params.bankId)
    .populate('createdBy', 'firstName lastName email');

  if (!bank) {
    return errorResponse(res, 404, 'Cooperative bank not found');
  }

  // Check access permissions
  const hasAccess = req.user.role === 'super_admin' || 
                   (req.user.cooperativeBankId && req.user.cooperativeBankId.toString() === req.params.bankId);

  if (!hasAccess) {
    return errorResponse(res, 403, 'Access denied');
  }

  successResponse(res, 200, 'Cooperative bank retrieved successfully', { bank });
}));

// Update cooperative bank
router.put('/:bankId', authenticateToken, authorizeRoles('super_admin'), [
  param('bankId').isMongoId().withMessage('Invalid bank ID'),
  body('bankName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Bank name cannot exceed 100 characters'),
  body('shortName')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Short name cannot exceed 20 characters'),
  body('contactDetails.phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('contactDetails.email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'under_review'])
    .withMessage('Invalid status')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const bank = await CooperativeBank.findById(req.params.bankId);

  if (!bank) {
    return errorResponse(res, 404, 'Cooperative bank not found');
  }

  const allowedUpdates = [
    'bankName', 'shortName', 'address', 'contactDetails', 
    'operationalDetails', 'settings', 'status', 'logo', 'theme'
  ];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const updatedBank = await CooperativeBank.findByIdAndUpdate(
    req.params.bankId,
    updates,
    { new: true, runValidators: true }
  );

  successResponse(res, 200, 'Cooperative bank updated successfully', { bank: updatedBank });
}));

// Update bank settings
router.put('/:bankId/settings', authenticateToken, authorizeRoles('super_admin'), [
  param('bankId').isMongoId().withMessage('Invalid bank ID'),
  body('defaultInterestRate.savings')
    .optional()
    .isNumeric()
    .withMessage('Savings interest rate must be a number'),
  body('defaultInterestRate.current')
    .optional()
    .isNumeric()
    .withMessage('Current interest rate must be a number'),
  body('defaultInterestRate.fixedDeposit')
    .optional()
    .isNumeric()
    .withMessage('Fixed deposit interest rate must be a number'),
  body('defaultInterestRate.recurringDeposit')
    .optional()
    .isNumeric()
    .withMessage('Recurring deposit interest rate must be a number'),
  body('minimumBalance.savings')
    .optional()
    .isNumeric()
    .withMessage('Savings minimum balance must be a number'),
  body('minimumBalance.current')
    .optional()
    .isNumeric()
    .withMessage('Current minimum balance must be a number'),
  body('transactionLimits.dailyWithdrawal')
    .optional()
    .isNumeric()
    .withMessage('Daily withdrawal limit must be a number'),
  body('transactionLimits.dailyTransfer')
    .optional()
    .isNumeric()
    .withMessage('Daily transfer limit must be a number'),
  body('transactionLimits.monthlyTransaction')
    .optional()
    .isNumeric()
    .withMessage('Monthly transaction limit must be a number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const bank = await CooperativeBank.findById(req.params.bankId);

  if (!bank) {
    return errorResponse(res, 404, 'Cooperative bank not found');
  }

  const updatedBank = await CooperativeBank.findByIdAndUpdate(
    req.params.bankId,
    { $set: { settings: { ...bank.settings, ...req.body } } },
    { new: true, runValidators: true }
  );

  successResponse(res, 200, 'Bank settings updated successfully', { bank: updatedBank });
}));

// Get bank statistics
router.get('/:bankId/stats', authenticateToken, [
  param('bankId').isMongoId().withMessage('Invalid bank ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const bank = await CooperativeBank.findById(req.params.bankId);

  if (!bank) {
    return errorResponse(res, 404, 'Cooperative bank not found');
  }

  // Check access permissions
  const hasAccess = req.user.role === 'super_admin' || 
                   (req.user.cooperativeBankId && req.user.cooperativeBankId.toString() === req.params.bankId);

  if (!hasAccess) {
    return errorResponse(res, 403, 'Access denied');
  }

  const totalUsers = await User.countDocuments({ 
    cooperativeBankId: req.params.bankId, 
    isActive: true 
  });

  const usersByRole = await User.aggregate([
    { $match: { cooperativeBankId: mongoose.Types.ObjectId(req.params.bankId), isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  const newUsersThisMonth = await User.countDocuments({
    cooperativeBankId: req.params.bankId,
    createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    isActive: true
  });

  successResponse(res, 200, 'Bank statistics retrieved successfully', {
    bankInfo: {
      bankName: bank.bankName,
      bankCode: bank.bankCode,
      status: bank.status,
      establishedDate: bank.establishedDate
    },
    totalUsers,
    usersByRole,
    newUsersThisMonth
  });
}));

// Search cooperative banks
router.get('/search/banks', authenticateToken, authorizeRoles('super_admin'), asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  
  if (!q) {
    return errorResponse(res, 400, 'Search query is required');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const searchRegex = new RegExp(q, 'i');
  
  const banks = await CooperativeBank.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { bankName: searchRegex },
          { shortName: searchRegex },
          { bankCode: searchRegex },
          { registrationNumber: searchRegex },
          { licenseNumber: searchRegex },
          { 'contactDetails.email': searchRegex }
        ]
      }
    ]
  })
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(parseInt(limit));

  const total = await CooperativeBank.countDocuments({
    $and: [
      { isActive: true },
      {
        $or: [
          { bankName: searchRegex },
          { shortName: searchRegex },
          { bankCode: searchRegex },
          { registrationNumber: searchRegex },
          { licenseNumber: searchRegex },
          { 'contactDetails.email': searchRegex }
        ]
      }
    ]
  });

  successResponse(res, 200, 'Search completed successfully', {
    banks,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    }
  });
}));

// Get system-wide statistics (Super Admin only)
router.get('/stats/system', authenticateToken, authorizeRoles('super_admin'), asyncHandler(async (req, res) => {
  const totalBanks = await CooperativeBank.countDocuments({ isActive: true });
  const totalUsers = await User.countDocuments({ isActive: true });
  
  const banksByStatus = await CooperativeBank.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const usersByRole = await User.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  const newBanksThisMonth = await CooperativeBank.countDocuments({
    createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    isActive: true
  });

  successResponse(res, 200, 'System statistics retrieved successfully', {
    totalBanks,
    totalUsers,
    banksByStatus,
    usersByRole,
    newBanksThisMonth
  });
}));

module.exports = router;
