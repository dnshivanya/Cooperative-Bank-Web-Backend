const express = require('express');
const { query, param } = require('express-validator');
const AuditLog = require('../models/AuditLog');
const AuditService = require('../services/auditService');
const { authenticateToken, authorizeRoles, authorizeBankAccess } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');

const router = express.Router();

// Get audit logs (Admin/Manager only) - Bank scoped
router.get('/', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('action').optional().isString().withMessage('Action must be a string'),
  query('resourceType').optional().isString().withMessage('Resource type must be a string'),
  query('status').optional().isIn(['SUCCESS', 'FAILED', 'PENDING']).withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  
  const filters = {
    cooperativeBankId: req.cooperativeBankId,
    ...req.query
  };

  // Remove pagination parameters from filters
  delete filters.page;
  delete filters.limit;

  const result = await AuditService.getAuditLogs(filters, page, limit);

  successResponse(res, 200, 'Audit logs retrieved successfully', result);
}));

// Get audit logs for specific user (Admin/Manager only) - Bank scoped
router.get('/user/:userId', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  
  const filters = {
    userId,
    cooperativeBankId: req.cooperativeBankId
  };

  const result = await AuditService.getAuditLogs(filters, page, limit);

  successResponse(res, 200, 'User audit logs retrieved successfully', result);
}));

// Get audit statistics (Admin/Manager only) - Bank scoped
router.get('/stats', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const stats = await AuditService.getAuditStatistics(
    req.cooperativeBankId,
    startDate,
    endDate
  );

  successResponse(res, 200, 'Audit statistics retrieved successfully', stats);
}));

// Get audit log by ID (Admin/Manager only) - Bank scoped
router.get('/:logId', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, [
  param('logId').isMongoId().withMessage('Invalid log ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const log = await AuditLog.findOne({
    _id: req.params.logId,
    cooperativeBankId: req.cooperativeBankId
  })
  .populate('userId', 'firstName lastName email')
  .populate('cooperativeBankId', 'bankName bankCode');

  if (!log) {
    return errorResponse(res, 404, 'Audit log not found');
  }

  successResponse(res, 200, 'Audit log retrieved successfully', { log });
}));

// Export audit logs (Super Admin only)
router.get('/export/csv', authenticateToken, authorizeRoles('super_admin'), [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('cooperativeBankId').optional().isMongoId().withMessage('Invalid cooperative bank ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { startDate, endDate, cooperativeBankId } = req.query;
  
  const filters = {};
  if (cooperativeBankId) filters.cooperativeBankId = cooperativeBankId;
  if (startDate && endDate) {
    filters.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const logs = await AuditLog.find(filters)
    .populate('userId', 'firstName lastName email')
    .populate('cooperativeBankId', 'bankName bankCode')
    .sort({ timestamp: -1 })
    .limit(10000); // Limit to prevent memory issues

  // Convert to CSV format
  const csvHeader = 'Timestamp,User,Cooperative Bank,Action,Resource Type,Resource ID,Status,IP Address,Details\n';
  const csvRows = logs.map(log => {
    const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
    return [
      log.timestamp.toISOString(),
      log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'Unknown',
      log.cooperativeBankId ? log.cooperativeBankId.bankName : 'Unknown',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.status,
      log.ipAddress || '',
      `"${details}"`
    ].join(',');
  }).join('\n');

  const csvContent = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
  res.send(csvContent);
}));

// Cleanup old audit logs (Super Admin only)
router.delete('/cleanup', authenticateToken, authorizeRoles('super_admin'), [
  query('daysToKeep').optional().isInt({ min: 30, max: 3650 }).withMessage('Days to keep must be between 30 and 3650')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const daysToKeep = parseInt(req.query.daysToKeep) || 365;
  
  const deletedCount = await AuditService.cleanupOldLogs(daysToKeep);

  successResponse(res, 200, 'Old audit logs cleaned up successfully', {
    deletedCount,
    daysToKeep
  });
}));

module.exports = router;
