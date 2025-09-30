# Multi-Tenant Cooperative Banking Backend API

A comprehensive multi-tenant backend API for managing multiple cooperative banks, similar to how regular banking works with HDFC, ICICI, Axis, etc. Built with Node.js, Express, and MongoDB.

## Features

- **Multi-Tenant Architecture**: Support for multiple cooperative banks
- **Cooperative Bank Management**: Create, manage, and configure different banks
- **User Management**: Registration, login, profile management per bank
- **Account Management**: Create accounts, view balances, account types per bank
- **Transaction Operations**: Deposit, withdrawal, transfer money within banks
- **Security**: JWT authentication, password hashing, input validation
- **Role-based Access**: Member, Manager, Admin, Super Admin roles
- **Bank-scoped Operations**: All operations are scoped to specific cooperative banks
- **Comprehensive Validation**: Input validation and error handling

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cooperative-banking-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/cooperative-banking
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   BCRYPT_ROUNDS=12
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/cooperative-banks` | Get available banks for registration | Public |
| POST | `/register` | Register new user (with bank selection) | Public |
| POST | `/login` | User login | Public |
| GET | `/profile` | Get user profile | Private |
| PUT | `/profile` | Update user profile | Private |
| PUT | `/change-password` | Change password | Private |

### Cooperative Bank Management Routes (`/api/cooperative-banks`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/` | Create new cooperative bank | Super Admin |
| GET | `/` | Get all cooperative banks | Super Admin |
| GET | `/:bankId` | Get bank details | Owner/Super Admin |
| PUT | `/:bankId` | Update bank details | Super Admin |
| PUT | `/:bankId/settings` | Update bank settings | Super Admin |
| GET | `/:bankId/stats` | Get bank statistics | Owner/Super Admin |
| GET | `/search/banks` | Search banks | Super Admin |
| GET | `/stats/system` | System-wide statistics | Super Admin |

### User Management Routes (`/api/users`) - Bank Scoped

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Get all users in bank | Admin/Manager |
| GET | `/:userId` | Get user by ID | Owner/Admin/Manager |
| PUT | `/:userId/status` | Update user status | Admin/Manager |
| PUT | `/:userId/role` | Update user role | Admin |
| GET | `/search/users` | Search users in bank | Admin/Manager |
| GET | `/stats/overview` | User statistics for bank | Admin/Manager |

### Account Routes (`/api/accounts`) - Bank Scoped

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/` | Create new account | Private |
| GET | `/my-accounts` | Get user's accounts | Private |
| GET | `/:accountId` | Get account details | Owner/Admin/Manager |
| GET | `/:accountId/balance` | Get account balance | Owner/Admin/Manager |
| PUT | `/:accountId` | Update account details | Owner/Admin/Manager |
| PUT | `/:accountId/deactivate` | Deactivate account | Owner/Admin/Manager |
| GET | `/admin/all-accounts` | Get all accounts in bank | Admin/Manager |
| GET | `/admin/stats` | Account statistics for bank | Admin/Manager |

### Transaction Routes (`/api/transactions`) - Bank Scoped

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/deposit` | Deposit money | Private |
| POST | `/withdraw` | Withdraw money | Private |
| POST | `/transfer` | Transfer money | Private |
| GET | `/history/:accountId` | Transaction history | Owner/Admin/Manager |
| GET | `/:transactionId` | Get transaction details | Owner/Admin/Manager |
| GET | `/admin/all-transactions` | Get all transactions in bank | Admin/Manager |
| GET | `/admin/stats` | Transaction statistics for bank | Admin/Manager |

## Data Models

### Cooperative Bank Model
- Bank identification (bank code, name, registration details)
- Contact and address information
- Banking details (IFSC, MICR, SWIFT codes)
- Operational settings (working hours, timezone)
- Financial details (capital, reserves)
- Bank-specific settings (interest rates, limits, fees)
- Status and theme configuration

### User Model
- Personal information (name, email, phone, DOB)
- Address details
- KYC documents (Aadhar, PAN)
- Occupation and income
- **Cooperative bank association**
- Role-based access (member, manager, admin, super_admin)

### Account Model
- Account number (auto-generated per bank)
- **Cooperative bank association**
- Account types (savings, current, FD, RD)
- Balance and minimum balance
- Interest rates
- Nominee details

### Transaction Model
- Transaction ID (auto-generated)
- **Cooperative bank association**
- Amount and transaction type
- Source and destination accounts
- Balance after transaction
- Processing details

## Security Features

- **JWT Authentication**: Secure token-based authentication with bank context
- **Password Hashing**: bcrypt for secure password storage
- **Input Validation**: Comprehensive validation using express-validator
- **Rate Limiting**: Protection against brute force attacks
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security headers
- **Role-based Authorization**: Different access levels (Member, Manager, Admin, Super Admin)
- **Bank-scoped Access**: All operations are scoped to specific cooperative banks
- **Multi-tenant Security**: Complete isolation between different cooperative banks

## Error Handling

The API includes comprehensive error handling:
- Validation errors with detailed messages
- Authentication and authorization errors
- Database operation errors
- Custom error responses with appropriate HTTP status codes

## Multi-Tenant Architecture

This backend supports multiple cooperative banks, similar to how regular banking works:

### How it Works:
1. **Super Admin** creates and manages different cooperative banks
2. **Each Bank** has its own:
   - Users and customers
   - Accounts and transactions
   - Settings and configurations
   - Admin and manager roles
3. **Complete Isolation**: Users can only access data from their own cooperative bank
4. **Bank-specific Operations**: All banking operations are scoped to the user's cooperative bank

### Example Structure:
```
Cooperative Banking System
├── Bank A (e.g., "City Cooperative Bank")
│   ├── Users (Members, Admin, Manager)
│   ├── Accounts (Savings, Current, FD)
│   └── Transactions
├── Bank B (e.g., "Rural Cooperative Society")
│   ├── Users (Members, Admin, Manager)
│   ├── Accounts (Savings, Current, FD)
│   └── Transactions
└── Bank C (e.g., "Urban Credit Union")
    ├── Users (Members, Admin, Manager)
    ├── Accounts (Savings, Current, FD)
    └── Transactions
```

## Development

### Project Structure
```
├── models/           # Database models
├── routes/           # API routes
├── middleware/       # Custom middleware
├── server.js         # Main server file
└── package.json      # Dependencies and scripts
```

### Available Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (when implemented)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
