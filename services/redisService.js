const { createClient } = require('redis');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        database: process.env.REDIS_DB || 0,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis connection refused');
            return new Error('Redis connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.warn('Redis client connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Rate limiting methods
  async checkRateLimit(key, limit, windowMs) {
    if (!this.isConnected) return { allowed: true, remaining: limit };

    try {
      const current = await this.client.get(key);
      
      if (current === null) {
        await this.client.setEx(key, Math.ceil(windowMs / 1000), '1');
        return { allowed: true, remaining: limit - 1 };
      }

      const count = parseInt(current);
      if (count >= limit) {
        return { allowed: false, remaining: 0 };
      }

      await this.client.incr(key);
      return { allowed: true, remaining: limit - count - 1 };
    } catch (error) {
      logger.error('Redis rate limit check failed:', error);
      return { allowed: true, remaining: limit };
    }
  }

  // Cache methods
  async get(key) {
    if (!this.isConnected) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get failed:', error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis set failed:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete failed:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) return false;
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists check failed:', error);
      return false;
    }
  }

  async expire(key, ttlSeconds) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      logger.error('Redis expire failed:', error);
      return false;
    }
  }

  // Session management
  async setSession(sessionId, sessionData, ttlSeconds = 86400) {
    const key = `session:${sessionId}`;
    return await this.set(key, sessionData, ttlSeconds);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // User-specific caching
  async setUserCache(userId, data, ttlSeconds = 1800) {
    const key = `user:${userId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getUserCache(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  async deleteUserCache(userId) {
    const key = `user:${userId}`;
    return await this.del(key);
  }

  // Bank-specific caching
  async setBankCache(bankId, data, ttlSeconds = 3600) {
    const key = `bank:${bankId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getBankCache(bankId) {
    const key = `bank:${bankId}`;
    return await this.get(key);
  }

  // Transaction caching
  async setTransactionCache(transactionId, data, ttlSeconds = 300) {
    const key = `transaction:${transactionId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getTransactionCache(transactionId) {
    const key = `transaction:${transactionId}`;
    return await this.get(key);
  }

  // API response caching
  async setApiCache(endpoint, params, data, ttlSeconds = 300) {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getApiCache(endpoint, params) {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return await this.get(key);
  }

  // Clear all cache
  async clearCache(pattern = '*') {
    if (!this.isConnected) return false;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error('Redis clear cache failed:', error);
      return false;
    }
  }

  // Get Redis info
  async getInfo() {
    if (!this.isConnected) return null;
    
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Redis info failed:', error);
      return null;
    }
  }
}

module.exports = new RedisService();
