const User = require('../../models/User');
const CooperativeBank = require('../../models/CooperativeBank');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  let testBank;

  beforeEach(async () => {
    testBank = await CooperativeBank.create({
      bankName: 'Test Bank',
      shortName: 'TB',
      registrationNumber: 'REG123',
      licenseNumber: 'LIC123',
      establishedDate: new Date(),
      address: {
        street: 'Test Street',
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
        ifscCode: 'TB0001234',
        micrCode: '123456789'
      },
      financialDetails: {
        authorizedCapital: 1000000,
        paidUpCapital: 500000
      }
    });
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
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
        cooperativeBankId: testBank._id
      };

      const user = await User.create(userData);
      
      expect(user.firstName).toBe(userData.firstName);
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.isActive).toBe(true);
      expect(user.role).toBe('member');
    });

    it('should hash password before saving', async () => {
      const userData = {
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
        cooperativeBankId: testBank._id
      };

      const user = await User.create(userData);
      const isPasswordHashed = await bcrypt.compare(userData.password, user.password);
      
      expect(isPasswordHashed).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidUserData = {
        firstName: 'John',
        // Missing required fields
      };

      await expect(User.create(invalidUserData)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
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
        cooperativeBankId: testBank._id
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate phone number format', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        phone: '123', // Invalid phone
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
        cooperativeBankId: testBank._id
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate Aadhar number format', async () => {
      const userData = {
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
        aadharNumber: '123', // Invalid Aadhar
        panNumber: 'ABCDE1234F',
        occupation: 'Software Engineer',
        monthlyIncome: 50000,
        cooperativeBankId: testBank._id
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate PAN number format', async () => {
      const userData = {
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
        panNumber: 'INVALID', // Invalid PAN
        occupation: 'Software Engineer',
        monthlyIncome: 50000,
        cooperativeBankId: testBank._id
      };

      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('User Methods', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
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
        cooperativeBankId: testBank._id
      });
    });

    it('should compare password correctly', async () => {
      const isCorrectPassword = await testUser.comparePassword('password123');
      const isWrongPassword = await testUser.comparePassword('wrongpassword');

      expect(isCorrectPassword).toBe(true);
      expect(isWrongPassword).toBe(false);
    });

    it('should return full name virtual field', () => {
      expect(testUser.fullName).toBe('John Doe');
    });

    it('should serialize virtual fields in JSON', () => {
      const userJSON = testUser.toJSON();
      expect(userJSON.fullName).toBe('John Doe');
    });
  });
});
