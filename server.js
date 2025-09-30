const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { requestLogger, errorLogger, securityLogger } = require('./middleware/logging');
const redisService = require('./services/redisService');
const { 
  globalLimiter, 
  userRateLimiter, 
  transactionRateLimiter,
  slowDownMiddleware 
} = require('./middleware/rateLimiting');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const cooperativeBankRoutes = require('./routes/cooperative-banks');
const auditRoutes = require('./routes/audit');
const kycRoutes = require('./routes/kyc');

const app = express();

// Initialize Redis connection
redisService.connect().then(connected => {
  if (connected) {
    logger.info('Redis connected successfully');
  } else {
    logger.warn('Redis connection failed, continuing without caching');
  }
});

// Security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
app.use(requestLogger);
app.use(securityLogger);

// Morgan HTTP logging with Winston
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
app.use(globalLimiter);
app.use(slowDownMiddleware);

// Body parsing middleware
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FIELD_SIZE || '1mb' 
}));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cooperative-banking', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  logger.info('MongoDB connected successfully');
  console.log('MongoDB connected successfully');
})
.catch(err => {
  logger.error('MongoDB connection error:', err);
  console.error('MongoDB connection error:', err);
});

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error:', err);
  console.error('MongoDB error:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cooperative-banks', cooperativeBankRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/kyc', kycRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Cooperative Banking API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
  logger.error('Error:', err.stack);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    console.log('Process terminated');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    console.log('Process terminated');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
