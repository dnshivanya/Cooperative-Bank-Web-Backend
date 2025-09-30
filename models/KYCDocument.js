const mongoose = require('mongoose');

const kycDocumentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cooperativeBankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CooperativeBank',
    required: true
  },
  documentType: {
    type: String,
    required: true,
    enum: [
      'AADHAR_FRONT', 'AADHAR_BACK', 'PAN_CARD', 'PASSPORT',
      'DRIVING_LICENSE', 'VOTER_ID', 'BANK_STATEMENT',
      'SALARY_CERTIFICATE', 'ADDRESS_PROOF', 'PHOTO'
    ]
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW'],
    default: 'PENDING'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  remarks: {
    type: String,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
kycDocumentSchema.index({ userId: 1, documentType: 1 });
kycDocumentSchema.index({ cooperativeBankId: 1, status: 1 });
kycDocumentSchema.index({ uploadDate: -1 });
kycDocumentSchema.index({ reviewedBy: 1 });

// Virtual for file URL
kycDocumentSchema.virtual('fileUrl').get(function() {
  return `/api/kyc/download/${this._id}`;
});

// Ensure virtual fields are serialized
kycDocumentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('KYCDocument', kycDocumentSchema);
