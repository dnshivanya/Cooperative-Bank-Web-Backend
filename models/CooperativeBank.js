const mongoose = require('mongoose');

const cooperativeBankSchema = new mongoose.Schema({
  bankCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6,
    match: [/^[A-Z]{6}$/, 'Bank code must be 6 uppercase letters']
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true,
    maxlength: [100, 'Bank name cannot exceed 100 characters']
  },
  shortName: {
    type: String,
    required: [true, 'Short name is required'],
    trim: true,
    maxlength: [20, 'Short name cannot exceed 20 characters']
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true,
    trim: true
  },
  establishedDate: {
    type: Date,
    required: [true, 'Established date is required']
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { 
      type: String, 
      required: true,
      match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
    },
    country: { type: String, default: 'India' }
  },
  contactDetails: {
    phone: {
      type: String,
      required: true,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, 'Please provide a valid website URL']
    }
  },
  bankingDetails: {
    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please provide a valid IFSC code']
    },
    micrCode: {
      type: String,
      required: true,
      match: [/^[0-9]{9}$/, 'Please provide a valid 9-digit MICR code']
    },
    swiftCode: {
      type: String,
      uppercase: true,
      match: [/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Please provide a valid SWIFT code']
    }
  },
  operationalDetails: {
    workingHours: {
      start: { type: String, required: true },
      end: { type: String, required: true }
    },
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  financialDetails: {
    authorizedCapital: {
      type: Number,
      required: true,
      min: [0, 'Authorized capital cannot be negative']
    },
    paidUpCapital: {
      type: Number,
      required: true,
      min: [0, 'Paid up capital cannot be negative']
    },
    reserveFund: {
      type: Number,
      default: 0,
      min: [0, 'Reserve fund cannot be negative']
    }
  },
  settings: {
    defaultInterestRate: {
      savings: { type: Number, default: 4.0 },
      current: { type: Number, default: 0.0 },
      fixedDeposit: { type: Number, default: 6.5 },
      recurringDeposit: { type: Number, default: 6.0 }
    },
    minimumBalance: {
      savings: { type: Number, default: 1000 },
      current: { type: Number, default: 5000 }
    },
    transactionLimits: {
      dailyWithdrawal: { type: Number, default: 50000 },
      dailyTransfer: { type: Number, default: 100000 },
      monthlyTransaction: { type: Number, default: 500000 }
    },
    fees: {
      accountOpening: { type: Number, default: 500 },
      monthlyMaintenance: { type: Number, default: 100 },
      transactionFee: { type: Number, default: 5 }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'under_review'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  logo: {
    type: String // URL to logo image
  },
  theme: {
    primaryColor: { type: String, default: '#1976d2' },
    secondaryColor: { type: String, default: '#dc004e' },
    accentColor: { type: String, default: '#ffc107' }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastAuditDate: {
    type: Date
  },
  nextAuditDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate bank code before saving
cooperativeBankSchema.pre('save', async function(next) {
  if (!this.bankCode) {
    const count = await mongoose.model('CooperativeBank').countDocuments();
    this.bankCode = String(count + 1).padStart(6, '0').replace(/\d/g, (match, offset) => 
      String.fromCharCode(65 + parseInt(match))
    );
  }
  next();
});

// Indexes for better query performance
cooperativeBankSchema.index({ bankCode: 1 });
cooperativeBankSchema.index({ bankName: 1 });
cooperativeBankSchema.index({ status: 1 });
cooperativeBankSchema.index({ isActive: 1 });

module.exports = mongoose.model('CooperativeBank', cooperativeBankSchema);
