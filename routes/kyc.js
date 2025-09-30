const express = require('express');
const { body, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const KYCDocument = require('../models/KYCDocument');
const { authenticateToken, authorizeRoles, authorizeBankAccess } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler, successResponse, errorResponse } = require('../middleware/validation');
const fileUploadService = require('../services/fileUploadService');
const AuditService = require('../services/auditService');
const { logProfileEvent } = require('../middleware/audit');
const { fileUploadRateLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// Configure multer
const upload = multer(fileUploadService.getMulterConfig());

// Upload KYC document
router.post('/upload', authenticateToken, fileUploadRateLimiter, upload.single('document'), [
  body('documentType')
    .isIn([
      'AADHAR_FRONT', 'AADHAR_BACK', 'PAN_CARD', 'PASSPORT',
      'DRIVING_LICENSE', 'VOTER_ID', 'BANK_STATEMENT',
      'SALARY_CERTIFICATE', 'ADDRESS_PROOF', 'PHOTO'
    ])
    .withMessage('Invalid document type')
], handleValidationErrors, logProfileEvent('KYC_UPLOAD'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return errorResponse(res, 400, 'No file uploaded');
  }

  const { documentType } = req.body;

  try {
    // Process the uploaded file
    const fileInfo = await fileUploadService.processFile(
      req.file.path,
      req.file.originalname,
      documentType,
      req.user._id
    );

    // Check if document of this type already exists
    const existingDoc = await KYCDocument.findOne({
      userId: req.user._id,
      documentType,
      isActive: true
    });

    if (existingDoc) {
      // Deactivate old document
      existingDoc.isActive = false;
      await existingDoc.save();
      
      // Delete old file
      await fileUploadService.deleteFile(existingDoc.filePath);
    }

    // Create new KYC document record
    const kycDocument = new KYCDocument({
      userId: req.user._id,
      cooperativeBankId: req.cooperativeBankId,
      documentType,
      fileName: fileInfo.fileName,
      originalFileName: fileInfo.originalFileName,
      filePath: fileInfo.filePath,
      fileSize: fileInfo.fileSize,
      mimeType: fileInfo.mimeType,
      status: 'PENDING'
    });

    await kycDocument.save();

    successResponse(res, 201, 'KYC document uploaded successfully', {
      document: kycDocument,
      fileUrl: kycDocument.fileUrl
    });
  } catch (error) {
    // Clean up uploaded file on error
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.error('Failed to clean up uploaded file:', unlinkError);
    }
    
    return errorResponse(res, 500, 'Failed to process uploaded file: ' + error.message);
  }
}));

// Get user's KYC documents
router.get('/my-documents', authenticateToken, asyncHandler(async (req, res) => {
  const documents = await KYCDocument.find({
    userId: req.user._id,
    isActive: true
  }).sort({ uploadDate: -1 });

  successResponse(res, 200, 'KYC documents retrieved successfully', { documents });
}));

// Get KYC document by ID
router.get('/:documentId', authenticateToken, [
  param('documentId').isMongoId().withMessage('Invalid document ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const document = await KYCDocument.findOne({
    _id: req.params.documentId,
    userId: req.user._id,
    isActive: true
  });

  if (!document) {
    return errorResponse(res, 404, 'KYC document not found');
  }

  successResponse(res, 200, 'KYC document retrieved successfully', { document });
}));

// Download KYC document
router.get('/download/:documentId', authenticateToken, [
  param('documentId').isMongoId().withMessage('Invalid document ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const document = await KYCDocument.findOne({
    _id: req.params.documentId,
    userId: req.user._id,
    isActive: true
  });

  if (!document) {
    return errorResponse(res, 404, 'KYC document not found');
  }

  try {
    const filePath = document.filePath;
    const fileName = document.originalFileName;

    // Check if file exists
    await fs.access(filePath);

    // Set appropriate headers
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', document.fileSize);

    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    return errorResponse(res, 404, 'File not found');
  }
}));

// Delete KYC document
router.delete('/:documentId', authenticateToken, [
  param('documentId').isMongoId().withMessage('Invalid document ID')
], handleValidationErrors, logProfileEvent('KYC_DELETE'), asyncHandler(async (req, res) => {
  const document = await KYCDocument.findOne({
    _id: req.params.documentId,
    userId: req.user._id,
    isActive: true
  });

  if (!document) {
    return errorResponse(res, 404, 'KYC document not found');
  }

  if (document.status === 'APPROVED') {
    return errorResponse(res, 400, 'Cannot delete approved documents');
  }

  // Deactivate document
  document.isActive = false;
  await document.save();

  // Delete file
  await fileUploadService.deleteFile(document.filePath);

  successResponse(res, 200, 'KYC document deleted successfully');
}));

// Get all KYC documents (Admin/Manager only) - Bank scoped
router.get('/admin/all-documents', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const status = req.query.status;

  const filter = { isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  if (status) {
    filter.status = status;
  }

  const documents = await KYCDocument.find(filter)
    .populate('userId', 'firstName lastName email phone')
    .populate('cooperativeBankId', 'bankName bankCode')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ uploadDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await KYCDocument.countDocuments(filter);

  successResponse(res, 200, 'KYC documents retrieved successfully', {
    documents,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
}));

// Review KYC document (Admin/Manager only) - Bank scoped
router.put('/:documentId/review', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, [
  param('documentId').isMongoId().withMessage('Invalid document ID'),
  body('status')
    .isIn(['APPROVED', 'REJECTED', 'UNDER_REVIEW'])
    .withMessage('Invalid status'),
  body('remarks')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Remarks cannot exceed 500 characters'),
  body('rejectionReason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Rejection reason cannot exceed 200 characters')
], handleValidationErrors, logProfileEvent('KYC_REVIEW'), asyncHandler(async (req, res) => {
  const { status, remarks, rejectionReason } = req.body;

  const filter = { _id: req.params.documentId, isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const document = await KYCDocument.findOne(filter);

  if (!document) {
    return errorResponse(res, 404, 'KYC document not found');
  }

  // Update document status
  document.status = status;
  document.reviewedBy = req.user._id;
  document.reviewedAt = new Date();
  document.remarks = remarks;

  if (status === 'REJECTED' && rejectionReason) {
    document.rejectionReason = rejectionReason;
  }

  await document.save();

  successResponse(res, 200, 'KYC document reviewed successfully', { document });
}));

// Get KYC statistics (Admin/Manager only) - Bank scoped
router.get('/admin/stats', authenticateToken, authorizeRoles('admin', 'manager'), authorizeBankAccess, asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  
  // If not super admin, filter by cooperative bank
  if (req.user.role !== 'super_admin') {
    filter.cooperativeBankId = req.cooperativeBankId;
  }

  const totalDocuments = await KYCDocument.countDocuments(filter);
  
  const documentsByStatus = await KYCDocument.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const documentsByType = await KYCDocument.aggregate([
    { $match: filter },
    { $group: { _id: '$documentType', count: { $sum: 1 } } }
  ]);

  const pendingReview = await KYCDocument.countDocuments({
    ...filter,
    status: 'PENDING'
  });

  successResponse(res, 200, 'KYC statistics retrieved successfully', {
    totalDocuments,
    documentsByStatus,
    documentsByType,
    pendingReview
  });
}));

module.exports = router;
