const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const CooperativeBank = require('../models/CooperativeBank');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');

const router = express.Router();

// Get available cooperative banks for registration
router.get('/cooperative-banks', asyncHandler(async (req, res) => {
  const banks = await CooperativeBank.find({ 
    isActive: true, 
    status: 'active' 
  }).select('bankName shortName bankCode address contactDetails');

  successResponse(res, 200, 'Cooperative banks retrieved successfully', { banks });
}));

// Register validation rules
const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
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
  body('aadharNumber')
    .matches(/^[0-9]{12}$/)
    .withMessage('Please provide a valid 12-digit Aadhar number'),
  body('panNumber')
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Please provide a valid PAN number'),
  body('occupation')
    .notEmpty()
    .withMessage('Occupation is required'),
  body('monthlyIncome')
    .isNumeric()
    .withMessage('Monthly income must be a number')
    .isFloat({ min: 0 })
    .withMessage('Monthly income cannot be negative'),
  body('cooperativeBankId')
    .isMongoId()
    .withMessage('Please select a valid cooperative bank')
];

// Login validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register route
router.post('/register', registerValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    dateOfBirth,
    address,
    aadharNumber,
    panNumber,
    occupation,
    monthlyIncome,
    cooperativeBankId
  } = req.body;

  // Check if cooperative bank exists and is active
  const cooperativeBank = await CooperativeBank.findById(cooperativeBankId);
  if (!cooperativeBank || !cooperativeBank.isActive) {
    return errorResponse(res, 400, 'Invalid or inactive cooperative bank');
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [
      { email },
      { phone },
      { aadharNumber },
      { panNumber }
    ]
  });

  if (existingUser) {
    return errorResponse(res, 400, 'User already exists with this email, phone, Aadhar, or PAN number');
  }

  // Create new user
  const user = new User({
    firstName,
    lastName,
    email,
    phone,
    password,
    dateOfBirth,
    address,
    aadharNumber,
    panNumber,
    occupation,
    monthlyIncome,
    cooperativeBankId
  });

  await user.save();

  // Generate token
  const token = generateToken(user._id, cooperativeBankId);

  // Return user data (without password)
  const userData = user.toJSON();
  delete userData.password;

  successResponse(res, 201, 'User registered successfully', {
    user: userData,
    cooperativeBank,
    token
  });
}));

// Login route
router.post('/login', loginValidation, handleValidationErrors, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  // Check if account is active
  if (!user.isActive) {
    return errorResponse(res, 401, 'Account is deactivated. Please contact support.');
  }

  // Compare password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return errorResponse(res, 401, 'Invalid email or password');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id, user.cooperativeBankId);

  // Return user data (without password)
  const userData = user.toJSON();
  delete userData.password;

  successResponse(res, 200, 'Login successful', {
    user: userData,
    cooperativeBank: user.cooperativeBankId,
    token
  });
}));

// Get current user profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  successResponse(res, 200, 'Profile retrieved successfully', { user });
}));

// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  body('phone')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('address.street')
    .optional()
    .notEmpty()
    .withMessage('Street address cannot be empty'),
  body('address.city')
    .optional()
    .notEmpty()
    .withMessage('City cannot be empty'),
  body('address.state')
    .optional()
    .notEmpty()
    .withMessage('State cannot be empty'),
  body('address.pincode')
    .optional()
    .matches(/^[0-9]{6}$/)
    .withMessage('Please provide a valid 6-digit pincode'),
  body('occupation')
    .optional()
    .notEmpty()
    .withMessage('Occupation cannot be empty'),
  body('monthlyIncome')
    .optional()
    .isNumeric()
    .withMessage('Monthly income must be a number')
    .isFloat({ min: 0 })
    .withMessage('Monthly income cannot be negative')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'occupation', 'monthlyIncome'];
  const updates = {};

  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  );

  successResponse(res, 200, 'Profile updated successfully', { user });
}));

// Change password
router.put('/change-password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return errorResponse(res, 400, 'Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  successResponse(res, 200, 'Password changed successfully');
}));

module.exports = router;
