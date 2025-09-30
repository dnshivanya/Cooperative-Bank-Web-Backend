const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
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
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN', 'LOGOUT', 'REGISTER', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
      'ACCOUNT_CREATE', 'ACCOUNT_UPDATE', 'ACCOUNT_DEACTIVATE',
      'TRANSACTION_DEPOSIT', 'TRANSACTION_WITHDRAWAL', 'TRANSACTION_TRANSFER',
      'USER_CREATE', 'USER_UPDATE', 'USER_DEACTIVATE', 'USER_ROLE_CHANGE',
      'BANK_CREATE', 'BANK_UPDATE', 'BANK_SETTINGS_UPDATE',
      'PROFILE_UPDATE', 'KYC_UPLOAD', 'STATEMENT_REQUEST'
    ]
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['USER', 'ACCOUNT', 'TRANSACTION', 'BANK', 'PROFILE', 'KYC']
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'PENDING'],
    default: 'SUCCESS'
  },
  errorMessage: {
    type: String,
    required: false
  },
  sessionId: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ cooperativeBankId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
