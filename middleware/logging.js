const logger = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.apiRequest('Incoming API Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    cooperativeBankId: req.cooperativeBankId,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.apiResponse('API Response Sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?._id,
      cooperativeBankId: req.cooperativeBankId,
      responseSize: chunk ? chunk.length : 0
    });

    // Log performance if request took too long
    if (duration > 5000) { // 5 seconds
      logger.performance('Slow API Request', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        userId: req.user?._id
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?._id,
    cooperativeBankId: req.cooperativeBankId,
    body: req.body,
    statusCode: err.statusCode || 500
  });

  next(err);
};

// Security event logging middleware
const securityLogger = (req, res, next) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./, // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /eval\(/i, // Code injection
    /javascript:/i // JavaScript injection
  ];

  const requestString = JSON.stringify({
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.security('Suspicious Request Detected', {
        pattern: pattern.toString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?._id,
        requestData: requestString
      });
      break;
    }
  }

  next();
};

// Database operation logging
const logDatabaseOperation = (operation, collection, query, result, error = null) => {
  if (error) {
    logger.database('Database Operation Failed', {
      operation,
      collection,
      query,
      error: error.message,
      stack: error.stack
    });
  } else {
    logger.database('Database Operation Success', {
      operation,
      collection,
      query,
      resultCount: Array.isArray(result) ? result.length : 1,
      executionTime: result.executionTime || 'unknown'
    });
  }
};

// Transaction logging
const logTransaction = (transactionData) => {
  logger.transaction('Transaction Processed', {
    transactionId: transactionData.transactionId,
    type: transactionData.type,
    amount: transactionData.amount,
    fromAccount: transactionData.fromAccount,
    toAccount: transactionData.toAccount,
    userId: transactionData.userId,
    cooperativeBankId: transactionData.cooperativeBankId,
    status: transactionData.status,
    processedBy: transactionData.processedBy
  });
};

// Email logging
const logEmail = (emailData) => {
  logger.email('Email Sent', {
    to: emailData.to,
    subject: emailData.subject,
    type: emailData.type,
    status: emailData.status,
    error: emailData.error
  });
};

// File upload logging
const logFileUpload = (fileData) => {
  logger.fileUpload('File Upload Processed', {
    fileName: fileData.fileName,
    originalFileName: fileData.originalFileName,
    fileSize: fileData.fileSize,
    mimeType: fileData.mimeType,
    documentType: fileData.documentType,
    userId: fileData.userId,
    cooperativeBankId: fileData.cooperativeBankId,
    status: fileData.status,
    error: fileData.error
  });
};

// Authentication logging
const logAuth = (authData) => {
  logger.audit('Authentication Event', {
    action: authData.action,
    userId: authData.userId,
    email: authData.email,
    ip: authData.ip,
    userAgent: authData.userAgent,
    success: authData.success,
    error: authData.error,
    cooperativeBankId: authData.cooperativeBankId
  });
};

module.exports = {
  requestLogger,
  errorLogger,
  securityLogger,
  logDatabaseOperation,
  logTransaction,
  logEmail,
  logFileUpload,
  logAuth
};
