const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    });
  }
});

// User-specific rate limiter
const userRateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 1000) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const key = `user:${userId}`;
    
    try {
      const result = await redisService.checkRateLimit(key, maxRequests, windowMs);
      
      if (!result.allowed) {
        logger.security('User rate limit exceeded', {
          userId,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });
        
        return res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      next();
    } catch (error) {
      logger.error('User rate limiter error:', error);
      next(); // Allow request if rate limiting fails
    }
  };
};

// Transaction-specific rate limiter
const transactionRateLimiter = (windowMs = 60 * 1000, maxTransactions = 10) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const key = `transaction:${userId}`;
    
    try {
      const result = await redisService.checkRateLimit(key, maxTransactions, windowMs);
      
      if (!result.allowed) {
        logger.security('Transaction rate limit exceeded', {
          userId,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });
        
        return res.status(429).json({
          success: false,
          message: 'Too many transactions, please wait before making another transaction.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      res.set({
        'X-RateLimit-Limit': maxTransactions,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      next();
    } catch (error) {
      logger.error('Transaction rate limiter error:', error);
      next();
    }
  };
};

// Login attempt rate limiter
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || 'unknown');
  },
  handler: (req, res) => {
    logger.security('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many login attempts, please try again later.',
      retryAfter: 900
    });
  }
});

// Password reset rate limiter
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    retryAfter: 3600
  },
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || 'unknown');
  },
  handler: (req, res) => {
    logger.security('Password reset rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: 3600
    });
  }
});

// File upload rate limiter
const fileUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 file uploads per hour
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
    retryAfter: 3600
  },
  handler: (req, res) => {
    logger.security('File upload rate limit exceeded', {
      userId: req.user?._id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many file uploads, please try again later.',
      retryAfter: 3600
    });
  }
});

// Simplified slow down middleware
const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window without delay
  delayMs: () => 500, // Fixed delay
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  }
});

// Admin operations rate limiter
const adminRateLimiter = (windowMs = 60 * 1000, maxRequests = 30) => {
  return async (req, res, next) => {
    if (!req.user || !['admin', 'manager', 'super_admin'].includes(req.user.role)) {
      return next();
    }

    const userId = req.user._id.toString();
    const key = `admin:${userId}`;
    
    try {
      const result = await redisService.checkRateLimit(key, maxRequests, windowMs);
      
      if (!result.allowed) {
        logger.security('Admin rate limit exceeded', {
          userId,
          role: req.user.role,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });
        
        return res.status(429).json({
          success: false,
          message: 'Too many admin operations, please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });

      next();
    } catch (error) {
      logger.error('Admin rate limiter error:', error);
      next();
    }
  };
};

module.exports = {
  globalLimiter,
  userRateLimiter,
  transactionRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
  fileUploadRateLimiter,
  slowDownMiddleware,
  adminRateLimiter
};