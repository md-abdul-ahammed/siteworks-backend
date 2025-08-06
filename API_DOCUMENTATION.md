# SiteWorks Authentication API Documentation

## Overview

This document describes the authentication API endpoints for the SiteWorks application. The API provides comprehensive user authentication, authorization, and profile management functionality.

## Base URL

```
http://localhost:8000/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. There are two types of tokens:

- **Access Token**: Short-lived token (15 minutes) for API requests
- **Refresh Token**: Long-lived token (7 days) for obtaining new access tokens

### Token Usage

Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Error Handling

All API responses follow a consistent error format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Authentication failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `TOKEN_EXPIRED`: JWT token has expired
- `INVALID_TOKEN`: Invalid JWT token
- `NETWORK_ERROR`: Network connectivity issues

## Endpoints

### 1. User Registration

**POST** `/auth/register`

Register a new user account.

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

#### Validation Rules

- Email: Valid email format, unique
- Password: Minimum 8 characters, must contain uppercase, lowercase, number, and special character
- Name: 2-50 characters

#### Response

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
    "expiresAt": "2024-01-01T00:15:00.000Z"
  }
}
```

#### Error Responses

- `400`: Validation error
- `409`: User already exists

### 2. User Login

**POST** `/auth/signin`

Authenticate user and obtain tokens.

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Response

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
    "expiresAt": "2024-01-01T00:15:00.000Z"
  }
}
```

#### Error Responses

- `400`: Validation error
- `401`: Invalid credentials or account deactivated

### 3. Token Refresh

**POST** `/auth/refresh`

Obtain new access token using refresh token.

#### Request Body

```json
{
  "refreshToken": "refresh_token"
}
```

#### Response

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "tokens": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_refresh_token",
    "expiresAt": "2024-01-01T00:15:00.000Z"
  }
}
```

#### Error Responses

- `400`: Validation error
- `401`: Invalid or expired refresh token

### 4. User Logout

**POST** `/auth/logout`

Logout user and revoke refresh token.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "refreshToken": "refresh_token"
}
```

#### Response

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 5. Logout from All Devices

**POST** `/auth/logout-all`

Logout user from all devices by revoking all refresh tokens.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response

```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

### 6. Get User Profile

**GET** `/auth/profile`

Get current user's profile information.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response

```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "isVerified": true,
    "isActive": true,
    "lastLoginAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Responses

- `401`: Invalid or expired token

### 7. Update User Profile

**PUT** `/auth/profile`

Update user's profile information.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "name": "Updated Name"
}
```

#### Response

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "Updated Name",
    "isVerified": true,
    "isActive": true,
    "lastLoginAt": "2024-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Responses

- `400`: Validation error
- `401`: Invalid or expired token

### 8. Change Password

**PUT** `/auth/change-password`

Change user's password.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

#### Response

```json
{
  "success": true,
  "message": "Password changed successfully. Please log in again."
}
```

#### Error Responses

- `400`: Validation error or incorrect current password
- `401`: Invalid or expired token

## Rate Limiting

The API implements rate limiting to prevent abuse:

- Registration: 5 requests per 15 minutes
- Login: 10 requests per 15 minutes
- Token refresh: 20 requests per 15 minutes
- General API: 100 requests per 15 minutes

When rate limit is exceeded:

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Token Security

- Access tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Refresh tokens are stored securely in database
- Tokens are automatically cleaned up when expired

### Account Security

- Account verification status tracking
- Account activation status
- Last login tracking
- Secure password hashing with bcrypt
- JWT token signing with secret key

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  isVerified BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  lastLoginAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
  id VARCHAR(255) PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  userId VARCHAR(255) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  isRevoked BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database"

# JWT
JWT_SECRET="your-secret-key"
JWT_ACCESS_EXPIRES_IN="15m"

# Server
PORT=8000
NODE_ENV="development"

# CORS
FRONTEND_URL="http://localhost:3000"
```

## Testing

### Test User Credentials

```json
{
  "email": "test@example.com",
  "password": "TestPassword123!",
  "name": "Test User"
}
```

### cURL Examples

#### Register User
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'
```

#### Login User
```bash
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

#### Get Profile
```bash
curl -X GET http://localhost:8000/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Support

For API support and questions, please contact the development team. 