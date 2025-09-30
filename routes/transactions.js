const express = require('express');
const { body, param } = require('express-validator');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');

const router = express.Router();

// Deposit money
router.post('/deposit', authenticateToken, [
  body('accountId')
    .isMongoId()
    .withMessage('Invalid account ID'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
  body('referenceNumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Reference number cannot exceed 50 characters')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { accountId, amount, description, referenceNumber } = req.body;

  // Find account
  const account = await Account.findById(accountId);
  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  if (!account.isActive) {
    return errorResponse(res, 400, 'Account is deactivated');
  }

  // Update account balance
  const newBalance = account.balance + amount;
  account.balance = newBalance;
  account.lastTransactionDate = new Date();
  await account.save();

  // Create transaction record
  const transaction = new Transaction({
    cooperativeBankId: req.cooperativeBankId,
    fromAccount: accountId,
    amount,
    transactionType: 'deposit',
    description,
    balanceAfter: newBalance,
    referenceNumber,
    processedBy: req.user._id
  });

  await transaction.save();

  successResponse(res, 201, 'Deposit successful', {
    transaction,
    newBalance
  });
}));

// Withdraw money
router.post('/withdraw', authenticateToken, [
  body('accountId')
    .isMongoId()
    .withMessage('Invalid account ID'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { accountId, amount, description } = req.body;

  // Find account
  const account = await Account.findById(accountId);
  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  if (!account.isActive) {
    return errorResponse(res, 400, 'Account is deactivated');
  }

  // Check sufficient balance
  const availableBalance = account.balance - account.minimumBalance;
  if (amount > availableBalance) {
    return errorResponse(res, 400, `Insufficient balance. Available: ${availableBalance}`);
  }

  // Update account balance
  const newBalance = account.balance - amount;
  account.balance = newBalance;
  account.lastTransactionDate = new Date();
  await account.save();

  // Create transaction record
  const transaction = new Transaction({
    cooperativeBankId: req.cooperativeBankId,
    fromAccount: accountId,
    amount,
    transactionType: 'withdrawal',
    description,
    balanceAfter: newBalance,
    processedBy: req.user._id
  });

  await transaction.save();

  successResponse(res, 201, 'Withdrawal successful', {
    transaction,
    newBalance
  });
}));

// Transfer money between accounts
router.post('/transfer', authenticateToken, [
  body('fromAccountId')
    .isMongoId()
    .withMessage('Invalid from account ID'),
  body('toAccountId')
    .isMongoId()
    .withMessage('Invalid to account ID'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { fromAccountId, toAccountId, amount, description } = req.body;

  if (fromAccountId === toAccountId) {
    return errorResponse(res, 400, 'Cannot transfer to the same account');
  }

  // Find both accounts
  const [fromAccount, toAccount] = await Promise.all([
    Account.findById(fromAccountId),
    Account.findById(toAccountId)
  ]);

  if (!fromAccount) {
    return errorResponse(res, 404, 'From account not found');
  }
  if (!toAccount) {
    return errorResponse(res, 404, 'To account not found');
  }

  // Check if user owns the from account or is admin/manager
  if (fromAccount.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied to from account');
  }

  if (!fromAccount.isActive || !toAccount.isActive) {
    return errorResponse(res, 400, 'One or both accounts are deactivated');
  }

  // Check sufficient balance
  const availableBalance = fromAccount.balance - fromAccount.minimumBalance;
  if (amount > availableBalance) {
    return errorResponse(res, 400, `Insufficient balance. Available: ${availableBalance}`);
  }

  // Start transaction
  const session = await Account.startSession();
  session.startTransaction();

  try {
    // Update from account balance
    fromAccount.balance -= amount;
    fromAccount.lastTransactionDate = new Date();
    await fromAccount.save({ session });

    // Update to account balance
    toAccount.balance += amount;
    toAccount.lastTransactionDate = new Date();
    await toAccount.save({ session });

    // Create transaction records
    const transaction = new Transaction({
      cooperativeBankId: req.cooperativeBankId,
      fromAccount: fromAccountId,
      toAccount: toAccountId,
      amount,
      transactionType: 'transfer',
      description,
      balanceAfter: fromAccount.balance,
      processedBy: req.user._id
    });

    await transaction.save({ session });

    await session.commitTransaction();

    successResponse(res, 201, 'Transfer successful', {
      transaction,
      fromAccountBalance: fromAccount.balance,
      toAccountBalance: toAccount.balance
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}));

// Get transaction history
router.get('/history/:accountId', authenticateToken, [
  param('accountId').isMongoId().withMessage('Invalid account ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Find account
  const account = await Account.findById(accountId);
  if (!account) {
    return errorResponse(res, 404, 'Account not found');
  }

  // Check if user owns this account or is admin/manager
  if (account.userId.toString() !== req.user._id.toString() && 
      !['admin', 'manager'].includes(req.user.role)) {
    return errorResponse(res, 403, 'Access denied');
  }

  // Get transactions
  const transactions = await Transaction.find({
    $or: [
      { fromAccount: accountId },
      { toAccount: accountId }
    ]
  })
  .populate('fromAccount', 'accountNumber')
  .populate('toAccount', 'accountNumber')
  .sort({ processedAt: -1 })
  .skip(skip)
  .limit(limit);

  const total = await Transaction.countDocuments({
    $or: [
      { fromAccount: accountId },
      { toAccount: accountId }
    ]
  });

  successResponse(res, 200, 'Transaction history retrieved successfully', {
    transactions,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get transaction by ID
router.get('/:transactionId', authenticateToken, [
  param('transactionId').isMongoId().withMessage('Invalid transaction ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.transactionId)
    .populate('fromAccount', 'accountNumber userId')
    .populate('toAccount', 'accountNumber userId')
    .populate('processedBy', 'firstName lastName');

  if (!transaction) {
    return errorResponse(res, 404, 'Transaction not found');
  }

  // Check if user has access to this transaction
  const hasAccess = ['admin', 'manager'].includes(req.user.role) ||
    (transaction.fromAccount && transaction.fromAccount.userId.toString() === req.user._id.toString()) ||
    (transaction.toAccount && transaction.toAccount.userId.toString() === req.user._id.toString());

  if (!hasAccess) {
    return errorResponse(res, 403, 'Access denied');
  }

  successResponse(res, 200, 'Transaction retrieved successfully', { transaction });
}));

// Get all transactions (Admin/Manager only) - Bank scoped
router.get('/admin/all-transactions', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const transactions = await Transaction.find(filter)
    .populate('fromAccount', 'accountNumber userId')
    .populate('toAccount', 'accountNumber userId')
    .populate('cooperativeBankId', 'bankName bankCode')
    .populate('processedBy', 'firstName lastName')
    .sort({ processedAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Transaction.countDocuments(filter);

  successResponse(res, 200, 'Transactions retrieved successfully', {
    transactions,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Get transaction statistics (Admin/Manager only) - Bank scoped
router.get('/admin/stats', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const filter = {};
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const totalTransactions = await Transaction.countDocuments(filter);
  
  const transactionsByType = await Transaction.aggregate([
    { $match: filter },
    { $group: { _id: '$transactionType', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
  ]);

  const todayTransactions = await Transaction.countDocuments({
    ...filter,
    processedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
  });

  const totalVolume = await Transaction.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  successResponse(res, 200, 'Transaction statistics retrieved successfully', {
    totalTransactions,
    transactionsByType,
    todayTransactions,
    totalVolume: totalVolume[0]?.total || 0
  });
}));

module.exports = router;
