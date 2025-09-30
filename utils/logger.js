const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'cooperative-banking-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test'
    }),
    
    // Combined log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    
    // Error log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    }),
    
    // Audit log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'info'
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add audit logging method
logger.audit = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'audit',
    timestamp: new Date().toISOString()
  });
};

// Add security logging method
logger.security = (message, meta = {}) => {
  logger.warn(message, {
    ...meta,
    logType: 'security',
    timestamp: new Date().toISOString()
  });
};

// Add transaction logging method
logger.transaction = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'transaction',
    timestamp: new Date().toISOString()
  });
};

// Add performance logging method
logger.performance = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'performance',
    timestamp: new Date().toISOString()
  });
};

// Add database logging method
logger.database = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'database',
    timestamp: new Date().toISOString()
  });
};

// Add email logging method
logger.email = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'email',
    timestamp: new Date().toISOString()
  });
};

// Add file upload logging method
logger.fileUpload = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'fileUpload',
    timestamp: new Date().toISOString()
  });
};

// Add API request logging method
logger.apiRequest = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'apiRequest',
    timestamp: new Date().toISOString()
  });
};

// Add API response logging method
logger.apiResponse = (message, meta = {}) => {
  logger.info(message, {
    ...meta,
    logType: 'apiResponse',
    timestamp: new Date().toISOString()
  });
};

// Create stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.apiRequest(message.trim());
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason
  });
  process.exit(1);
});

module.exports = logger;
