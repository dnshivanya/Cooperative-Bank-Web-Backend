const AuditLog = require('../models/AuditLog');

class AuditService {
  // Log user authentication events
  static async logAuthEvent(userId, cooperativeBankId, action, details = {}, req = null) {
    try {
      const auditData = {
        userId,
        cooperativeBankId,
        action,
        resourceType: 'USER',
        details,
        status: 'SUCCESS'
      };

      if (req) {
        auditData.ipAddress = req.ip || req.connection.remoteAddress;
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = req.sessionID;
      }

      await AuditLog.create(auditData);
    } catch (error) {
      console.error('Failed to log auth event:', error);
    }
  }

  // Log account events
  static async logAccountEvent(userId, cooperativeBankId, action, accountId, details = {}, req = null) {
    try {
      const auditData = {
        userId,
        cooperativeBankId,
        action,
        resourceType: 'ACCOUNT',
        resourceId: accountId,
        details,
        status: 'SUCCESS'
      };

      if (req) {
        auditData.ipAddress = req.ip || req.connection.remoteAddress;
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = req.sessionID;
      }

      await AuditLog.create(auditData);
    } catch (error) {
      console.error('Failed to log account event:', error);
    }
  }

  // Log transaction events
  static async logTransactionEvent(userId, cooperativeBankId, action, transactionId, details = {}, req = null) {
    try {
      const auditData = {
        userId,
        cooperativeBankId,
        action,
        resourceType: 'TRANSACTION',
        resourceId: transactionId,
        details,
        status: 'SUCCESS'
      };

      if (req) {
        auditData.ipAddress = req.ip || req.connection.remoteAddress;
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = req.sessionID;
      }

      await AuditLog.create(auditData);
    } catch (error) {
      console.error('Failed to log transaction event:', error);
    }
  }

  // Log bank management events
  static async logBankEvent(userId, cooperativeBankId, action, bankId, details = {}, req = null) {
    try {
      const auditData = {
        userId,
        cooperativeBankId,
        action,
        resourceType: 'BANK',
        resourceId: bankId,
        details,
        status: 'SUCCESS'
      };

      if (req) {
        auditData.ipAddress = req.ip || req.connection.remoteAddress;
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = req.sessionID;
      }

      await AuditLog.create(auditData);
    } catch (error) {
      console.error('Failed to log bank event:', error);
    }
  }

  // Log profile events
  static async logProfileEvent(userId, cooperativeBankId, action, details = {}, req = null) {
    try {
      const auditData = {
        userId,
        cooperativeBankId,
        action,
        resourceType: 'PROFILE',
        details,
        status: 'SUCCESS'
      };

      if (req) {
        auditData.ipAddress = req.ip || req.connection.remoteAddress;
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = req.sessionID;
      }

      await AuditLog.create(auditData);
    } catch (error) {
      console.error('Failed to log profile event:', error);
    }
  }

  // Log failed events
  static async logFailedEvent(userId, cooperativeBankId, action, resourceType, errorMessage, details = {}, req = null) {
    try {
      const auditData = {
        userId,
        cooperativeBankId,
        action,
        resourceType,
        details,
        status: 'FAILED',
        errorMessage
      };

      if (req) {
        auditData.ipAddress = req.ip || req.connection.remoteAddress;
        auditData.userAgent = req.get('User-Agent');
        auditData.sessionId = req.sessionID;
      }

      await AuditLog.create(auditData);
    } catch (error) {
      console.error('Failed to log failed event:', error);
    }
  }

  // Get audit logs with filtering
  static async getAuditLogs(filters = {}, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;
      
      const query = {};
      
      if (filters.userId) query.userId = filters.userId;
      if (filters.cooperativeBankId) query.cooperativeBankId = filters.cooperativeBankId;
      if (filters.action) query.action = filters.action;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.status) query.status = filters.status;
      if (filters.startDate && filters.endDate) {
        query.timestamp = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      const logs = await AuditLog.find(query)
        .populate('userId', 'firstName lastName email')
        .populate('cooperativeBankId', 'bankName bankCode')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AuditLog.countDocuments(query);

      return {
        logs,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  // Get audit statistics
  static async getAuditStatistics(cooperativeBankId, startDate, endDate) {
    try {
      const matchQuery = { cooperativeBankId };
      
      if (startDate && endDate) {
        matchQuery.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const stats = await AuditLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const totalLogs = await AuditLog.countDocuments(matchQuery);
      const uniqueUsers = await AuditLog.distinct('userId', matchQuery);

      return {
        totalLogs,
        uniqueUsers: uniqueUsers.length,
        actionStats: stats
      };
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }

  // Clean up old audit logs (older than specified days)
  static async cleanupOldLogs(daysToKeep = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      console.log(`Cleaned up ${result.deletedCount} old audit logs`);
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
