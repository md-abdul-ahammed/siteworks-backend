const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Custom error class for authentication errors
class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthError('Access token is required', 401);
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      throw new AuthError('Invalid token format', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if customer exists and is active
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        countryOfResidence: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postcode: true,
        state: true,
        role: true,
        isVerified: true,
        isActive: true,
        lastLoginAt: true
      }
    });

    if (!customer) {
      throw new AuthError('Customer not found', 401);
    }

    // For admin users, skip verification and active checks
    if (customer.role === 'admin') {
      req.user = customer;
      return next();
    }

    // For regular users, check verification and active status
    if (!customer.isActive) {
      throw new AuthError('Customer account is deactivated', 401);
    }

    if (!customer.isVerified) {
      throw new AuthError('Customer account is not verified', 401);
    }

    // Add customer to request object
    req.user = customer; // Keep as req.user for compatibility
    next();

  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: 'AUTH_ERROR'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        countryOfResidence: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postcode: true,
        state: true,
        isVerified: true,
        isActive: true
      }
    });

    if (customer && customer.isActive && customer.isVerified) {
      req.user = customer; // Keep as req.user for compatibility
    }

    next();

  } catch (error) {
    // Don't fail for optional auth, just continue without customer
    next();
  }
};

// Rate limiting middleware
const rateLimiter = (options = {}) => {
  const { windowMs = 15 * 60 * 1000, max = 200 } = options;
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      const record = requests.get(ip);
      
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
      } else {
        record.count++;
      }
      
      if (record.count > max) {
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }
    }
    
    next();
  };
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof AuthError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: 'AUTH_ERROR'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Resource already exists',
        code: 'DUPLICATE_ENTRY'
      });
    }
  }

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

module.exports = {
  verifyToken,
  optionalAuth,
  rateLimiter,
  errorHandler,
  AuthError
}; 