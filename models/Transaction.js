const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  cooperativeBankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CooperativeBank',
    required: true
  },
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: function() {
      return this.transactionType !== 'deposit';
    }
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: function() {
      return this.transactionType === 'transfer';
    }
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  transactionType: {
    type: String,
    enum: ['deposit', 'withdrawal', 'transfer', 'interest', 'penalty'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  referenceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  remarks: {
    type: String,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
transactionSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.transactionId = `TXN${timestamp}${random}`;
  }
  next();
});

// Indexes for better query performance
transactionSchema.index({ cooperativeBankId: 1 });
transactionSchema.index({ fromAccount: 1, processedAt: -1 });
transactionSchema.index({ toAccount: 1, processedAt: -1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ processedAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
