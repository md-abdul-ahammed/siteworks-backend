const { PrismaClientKnownRequestError } = require('@prisma/client/runtime/library');

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
  }
}

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle known error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'VALIDATION_ERROR',
      details: err.details,
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'AUTHENTICATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof AuthorizationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'AUTHORIZATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof ConflictError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'CONFLICT',
      timestamp: new Date().toISOString()
    });
  }

  if (err instanceof RateLimitError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }

  // Handle Prisma errors
  if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Resource already exists',
          code: 'DUPLICATE_ENTRY',
          field: err.meta?.target?.[0] || 'unknown',
          timestamp: new Date().toISOString()
        });
      
      case 'P2025':
        return res.status(404).json({
          error: 'Resource not found',
          code: 'NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      
      case 'P2003':
        return res.status(400).json({
          error: 'Invalid foreign key reference',
          code: 'FOREIGN_KEY_CONSTRAINT',
          timestamp: new Date().toISOString()
        });
      
      default:
        return res.status(500).json({
          error: 'Database operation failed',
          code: 'DATABASE_ERROR',
          timestamp: new Date().toISOString()
        });
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token has expired',
      code: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString()
    });
  }

  // Handle bcrypt errors
  if (err.name === 'BCryptError') {
    return res.status(500).json({
      error: 'Password processing error',
      code: 'PASSWORD_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Handle network/connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    });
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError' && Array.isArray(err.array)) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.array(),
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  return res.status(statusCode).json({
    error: message,
    code: code,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError
}; 