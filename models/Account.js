const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    length: 12
  },
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
  accountType: {
    type: String,
    enum: ['savings', 'current', 'fixed_deposit', 'recurring_deposit'],
    default: 'savings',
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  minimumBalance: {
    type: Number,
    default: 1000,
    min: [0, 'Minimum balance cannot be negative']
  },
  interestRate: {
    type: Number,
    default: 4.0,
    min: [0, 'Interest rate cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  openedDate: {
    type: Date,
    default: Date.now
  },
  lastTransactionDate: {
    type: Date
  },
  branchCode: {
    type: String,
    required: true,
    default: '001'
  },
  nomineeDetails: {
    name: String,
    relationship: String,
    phone: String,
    aadharNumber: String
  }
}, {
  timestamps: true
});

// Generate account number before saving
accountSchema.pre('save', async function(next) {
  if (!this.accountNumber) {
    const count = await mongoose.model('Account').countDocuments({ cooperativeBankId: this.cooperativeBankId });
    this.accountNumber = String(count + 1).padStart(12, '0');
  }
  next();
});

// Index for better query performance
accountSchema.index({ userId: 1 });
accountSchema.index({ accountNumber: 1 });
accountSchema.index({ cooperativeBankId: 1 });

module.exports = mongoose.model('Account', accountSchema);
