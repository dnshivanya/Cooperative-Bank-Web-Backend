# Cooperative Banking Backend API

A comprehensive, production-ready backend API for cooperative banking systems built with Node.js, Express, MongoDB, and Redis.

## 🚀 Features

### Core Banking Features
- **User Management**: Registration, authentication, profile management
- **Account Management**: Multiple account types (Savings, Current, FD, RD)
- **Transaction Processing**: Deposits, withdrawals, transfers with validation
- **Cooperative Bank Management**: Multi-bank support with bank-specific settings
- **KYC Document Management**: Secure file upload and verification system

### Security & Compliance
- **JWT Authentication**: Secure token-based authentication
- **Role-based Authorization**: Member, Admin, Manager, Super Admin roles
- **Audit Logging**: Comprehensive activity tracking
- **Rate Limiting**: Per-user and per-endpoint rate limiting
- **Input Validation**: Comprehensive request validation
- **Security Headers**: Helmet.js security middleware

### Performance & Monitoring
- **Redis Caching**: High-performance caching layer
- **Winston Logging**: Structured logging with rotation
- **Health Checks**: Application health monitoring
- **Performance Monitoring**: Request timing and metrics
- **Error Tracking**: Comprehensive error handling and logging

### Email & Notifications
- **Email Service**: Transaction notifications, password reset
- **Template System**: Professional email templates
- **SMTP Integration**: Configurable email delivery

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer with Sharp image processing
- **Logging**: Winston with daily rotation
- **Testing**: Jest with Supertest
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 7.0+
- Redis 7.0+
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cooperative-banking-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your settings
   ```

4. **Start services with Docker**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh development
   ```

5. **Or start manually**
   ```bash
   # Start MongoDB and Redis
   # Update config.env with connection details
   
   # Start the application
   npm run dev
   ```

### Production Deployment

1. **Using Docker Compose**
   ```bash
   ./deploy.sh production
   ```

2. **Using PM2**
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js --env production
   ```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### User Management
- `GET /api/users` - List users (Admin/Manager)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id/status` - Update user status
- `PUT /api/users/:id/role` - Update user role

### Account Management
- `POST /api/accounts` - Create account
- `GET /api/accounts/my-accounts` - Get user's accounts
- `GET /api/accounts/:id` - Get account details
- `GET /api/accounts/:id/balance` - Get account balance

### Transaction Processing
- `POST /api/transactions/deposit` - Deposit money
- `POST /api/transactions/withdraw` - Withdraw money
- `POST /api/transactions/transfer` - Transfer money
- `GET /api/transactions/history/:accountId` - Transaction history

### KYC Document Management
- `POST /api/kyc/upload` - Upload KYC document
- `GET /api/kyc/my-documents` - Get user's documents
- `GET /api/kyc/:id` - Get document details
- `DELETE /api/kyc/:id` - Delete document

### Audit & Monitoring
- `GET /api/audit` - Get audit logs (Admin/Manager)
- `GET /api/audit/stats` - Get audit statistics
- `GET /api/health` - Health check

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/cooperative-banking

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Logging
LOG_LEVEL=info
LOG_DIR=logs
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

## 📊 Monitoring & Logs

### Log Files
- `logs/combined-YYYY-MM-DD.log` - All logs
- `logs/error-YYYY-MM-DD.log` - Error logs only
- `logs/audit-YYYY-MM-DD.log` - Audit logs

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Monitoring Endpoints
- Health check: `/api/health`
- Metrics: `/api/metrics` (if enabled)

## 🔒 Security Features

### Rate Limiting
- Global: 100 requests per 15 minutes
- Login: 5 attempts per 15 minutes
- Transactions: 10-20 per minute (type dependent)
- File uploads: 20 per hour

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security

### Input Validation
- Email format validation
- Phone number validation (10 digits)
- Aadhar number validation (12 digits)
- PAN number validation
- File type and size validation

## 🚀 Deployment Options

### Docker Deployment
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### PM2 Deployment
```bash
pm2 start ecosystem.config.js --env production
```

### Manual Deployment
```bash
npm install --production
npm start
```

## 📈 Performance Optimization

### Caching Strategy
- User sessions: Redis
- API responses: Redis (configurable)
- Database queries: Mongoose caching

### Database Optimization
- Indexed fields for fast queries
- Connection pooling
- Query optimization

### File Processing
- Image compression with Sharp
- PDF validation
- Secure file storage

## 🔧 Development

### Project Structure
```
├── config/           # Configuration files
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic services
├── tests/           # Test files
├── utils/           # Utility functions
├── uploads/         # File uploads
├── logs/            # Log files
└── server.js        # Application entry point
```

### Adding New Features
1. Create model in `models/`
2. Add routes in `routes/`
3. Implement business logic in `services/`
4. Add middleware for validation/auth
5. Write tests in `tests/`
6. Update documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the logs for error details

## 🔄 Updates & Maintenance

### Regular Tasks
- Database backups
- Log rotation
- Security updates
- Performance monitoring
- Dependency updates

### Backup Strategy
- Automated daily backups
- 30-day retention
- Point-in-time recovery
- Cross-region replication (production)

---

**Built with ❤️ for cooperative banking systems**