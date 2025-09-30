const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CooperativeBank = require('../models/CooperativeBank');
const Account = require('../models/Account');

// Test data factories
const createTestBank = async (overrides = {}) => {
  const defaultData = {
    bankName: 'Test Cooperative Bank',
    shortName: 'TCB',
    registrationNumber: 'REG123456',
    licenseNumber: 'LIC123456',
    establishedDate: new Date('2020-01-01'),
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      country: 'India'
    },
    contactDetails: {
      phone: '9876543210',
      email: 'test@bank.com'
    },
    bankingDetails: {
      ifscCode: 'TCB0001234',
      micrCode: '123456789'
    },
    financialDetails: {
      authorizedCapital: 1000000,
      paidUpCapital: 500000
    },
    ...overrides
  };

  return await CooperativeBank.create(defaultData);
};

const createTestUser = async (bankId, overrides = {}) => {
  const defaultData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@test.com',
    phone: '9876543210',
    password: 'password123',
    dateOfBirth: new Date('1990-01-01'),
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      pincode: '123456',
      country: 'India'
    },
    aadharNumber: '123456789012',
    panNumber: 'ABCDE1234F',
    occupation: 'Software Engineer',
    monthlyIncome: 50000,
    cooperativeBankId: bankId,
    role: 'member',
    ...overrides
  };

  return await User.create(defaultData);
};

const createTestAccount = async (userId, bankId, overrides = {}) => {
  const defaultData = {
    userId,
    cooperativeBankId: bankId,
    accountType: 'savings',
    balance: 10000,
    minimumBalance: 1000,
    interestRate: 4.0,
    ...overrides
  };

  return await Account.create(defaultData);
};

// Generate test JWT token
const generateTestToken = (userId, cooperativeBankId = null) => {
  return jwt.sign(
    { userId, cooperativeBankId },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

// Test request helpers
const createAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
});

module.exports = {
  createTestBank,
  createTestUser,
  createTestAccount,
  generateTestToken,
  createAuthHeaders
};
