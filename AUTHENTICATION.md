# JWT Authentication System

This document describes the comprehensive JWT authentication system implemented in the SiteWorks backend.

## Features

- ✅ JWT-based authentication with access and refresh tokens
- ✅ Secure password hashing with bcrypt
- ✅ Rate limiting for all endpoints
- ✅ Input validation with express-validator
- ✅ Comprehensive error handling
- ✅ Token refresh mechanism
- ✅ Logout from all devices
- ✅ Password change functionality
- ✅ User profile management
- ✅ Automatic cleanup of expired tokens
- ✅ Security headers with helmet
- ✅ CORS configuration

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/siteworks_db"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here-make-it-long-and-random"
JWT_ACCESS_EXPIRES_IN="15m"

# Brevo Email Configuration
BREVO_API_KEY="your-brevo-api-key"
BREVO_SENDER_NAME="SiteWorks"
BREVO_SENDER_EMAIL="noreply@siteworks.com"

# Server Configuration
PORT=8000
NODE_ENV="development"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:3000"
```

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "isVerified": true,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token",
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

#### POST `/api/auth/login`
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "isVerified": true,
    "isActive": true,
    "lastLoginAt": "2024-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token",
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "tokens": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_refresh_token",
    "expiresAt": "2024-01-08T00:00:00.000Z"
  }
}
```

#### POST `/api/auth/logout`
Logout user (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

#### POST `/api/auth/logout-all`
Logout from all devices (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

#### GET `/api/auth/profile`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

#### PUT `/api/auth/profile`
Update user profile (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "name": "Updated Name"
}
```

#### PUT `/api/auth/change-password`
Change password (requires authentication).

**Headers:**
```
Authorization: Bearer jwt_access_token
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

## Error Codes

The API returns standardized error codes:

- `AUTH_ERROR` - Authentication-related errors
- `VALIDATION_ERROR` - Input validation errors
- `INVALID_TOKEN` - Invalid JWT token
- `TOKEN_EXPIRED` - Expired JWT token
- `INVALID_CREDENTIALS` - Wrong email/password
- `ACCOUNT_DEACTIVATED` - User account is deactivated
- `USER_EXISTS` - User already exists
- `INVALID_REFRESH_TOKEN` - Invalid refresh token
- `INVALID_CURRENT_PASSWORD` - Wrong current password
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `DUPLICATE_ENTRY` - Database duplicate entry
- `INTERNAL_ERROR` - Server error

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting
- Registration: 5 requests per 15 minutes
- Login: 10 requests per 15 minutes
- Token refresh: 20 requests per 15 minutes
- Global: 100 requests per 15 minutes

### Token Management
- Access tokens expire in 15 minutes (configurable)
- Refresh tokens expire in 7 days
- Automatic cleanup of expired tokens every hour
- Secure token storage in database

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Request size limits
- Input validation and sanitization

## Database Schema

### User Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password TEXT NOT NULL,
  isVerified BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  lastLoginAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### RefreshToken Table
```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  userId TEXT NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  isRevoked BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

## Usage Examples

### Frontend Integration

```javascript
// Login
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store tokens
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
  }
  
  return data;
};

// Authenticated request
const authenticatedRequest = async (url, options = {}) => {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (response.status === 401) {
    // Token expired, try to refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry request with new token
      return authenticatedRequest(url, options);
    }
  }
  
  return response;
};

// Refresh token
const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
    return true;
  }
  
  // Refresh failed, redirect to login
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
  return false;
};
```

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env` file

3. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

## Testing

Test the authentication endpoints using tools like Postman or curl:

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
``` 