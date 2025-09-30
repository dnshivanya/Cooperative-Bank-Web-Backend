const AuditService = require('../services/auditService');

// Middleware to log authentication events
const logAuthEvent = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the event after response is sent
      if (req.user && res.statusCode < 400) {
        AuditService.logAuthEvent(
          req.user._id,
          req.cooperativeBankId,
          action,
          { 
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode
          },
          req
        );
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware to log account events
const logAccountEvent = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the event after response is sent
      if (req.user && res.statusCode < 400) {
        const accountId = req.params.accountId || req.body.accountId;
        AuditService.logAccountEvent(
          req.user._id,
          req.cooperativeBankId,
          action,
          accountId,
          { 
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode,
            ...req.body
          },
          req
        );
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware to log transaction events
const logTransactionEvent = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the event after response is sent
      if (req.user && res.statusCode < 400) {
        const transactionId = req.params.transactionId || req.body.transactionId;
        AuditService.logTransactionEvent(
          req.user._id,
          req.cooperativeBankId,
          action,
          transactionId,
          { 
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode,
            amount: req.body.amount,
            transactionType: req.body.transactionType || action.split('_')[1].toLowerCase()
          },
          req
        );
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware to log profile events
const logProfileEvent = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the event after response is sent
      if (req.user && res.statusCode < 400) {
        AuditService.logProfileEvent(
          req.user._id,
          req.cooperativeBankId,
          action,
          { 
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode,
            updatedFields: Object.keys(req.body)
          },
          req
        );
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware to log bank management events
const logBankEvent = (action) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the event after response is sent
      if (req.user && res.statusCode < 400) {
        const bankId = req.params.bankId || req.body.bankId;
        AuditService.logBankEvent(
          req.user._id,
          req.cooperativeBankId,
          action,
          bankId,
          { 
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode,
            updatedFields: Object.keys(req.body)
          },
          req
        );
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Error logging middleware
const logError = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log failed events
    if (req.user && res.statusCode >= 400) {
      const errorMessage = typeof data === 'string' ? data : data.message || 'Unknown error';
      
      AuditService.logFailedEvent(
        req.user._id,
        req.cooperativeBankId,
        `${req.method}_${req.route?.path?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`,
        'GENERAL',
        errorMessage,
        { 
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          body: req.body
        },
        req
      );
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  logAuthEvent,
  logAccountEvent,
  logTransactionEvent,
  logProfileEvent,
  logBankEvent,
  logError
};
