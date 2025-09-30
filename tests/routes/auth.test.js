const request = require('supertest');
const app = require('../../server');
const { createTestBank, createTestUser, generateTestToken, createAuthHeaders } = require('../utils/testHelpers');

describe('Auth Routes', () => {
  let testBank;
  let testUser;

  beforeEach(async () => {
    testBank = await createTestBank();
    testUser = await createTestUser(testBank._id);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        phone: '9876543211',
        password: 'password123',
        dateOfBirth: '1995-05-15',
        address: {
          street: '456 Test Avenue',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'India'
        },
        aadharNumber: '123456789013',
        panNumber: 'ABCDE1235F',
        occupation: 'Teacher',
        monthlyIncome: 40000,
        cooperativeBankId: testBank._id
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail registration with duplicate email', async () => {
      const userData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: testUser.email, // Duplicate email
        phone: '9876543211',
        password: 'password123',
        dateOfBirth: '1995-05-15',
        address: {
          street: '456 Test Avenue',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'India'
        },
        aadharNumber: '123456789013',
        panNumber: 'ABCDE1235F',
        occupation: 'Teacher',
        monthlyIncome: 40000,
        cooperativeBankId: testBank._id
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should fail registration with invalid data', async () => {
      const invalidData = {
        firstName: '', // Invalid: empty
        email: 'invalid-email', // Invalid: not an email
        password: '123', // Invalid: too short
        cooperativeBankId: testBank._id
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail login with invalid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should fail login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile with valid token', async () => {
      const token = generateTestToken(testUser._id, testBank._id);
      const headers = createAuthHeaders(token);

      const response = await request(app)
        .get('/api/auth/profile')
        .set(headers)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should fail to get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should fail to get profile with invalid token', async () => {
      const headers = createAuthHeaders('invalid-token');

      const response = await request(app)
        .get('/api/auth/profile')
        .set(headers)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset instructions for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset instructions sent to your email');
    });

    it('should fail for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found with this email');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetToken = generateTestToken(testUser._id, null, '1h');
      
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset successfully');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newpassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired reset token');
    });
  });
});
