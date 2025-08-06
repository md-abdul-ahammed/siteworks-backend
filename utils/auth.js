const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Generate access token
const generateAccessToken = (customerId) => {
  return jwt.sign(
    { customerId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// Generate password reset token
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Create refresh token in database
const createRefreshToken = async (customerId, token, expiresAt) => {
  return await prisma.refreshToken.create({
    data: {
      token,
      customerId,
      expiresAt
    }
  });
};

// Create password reset token in database
const createPasswordResetToken = async (customerId, token, expiresAt) => {
  return await prisma.passwordResetToken.create({
    data: {
      token,
      customerId,
      expiresAt
    }
  });
};

// Verify refresh token
const verifyRefreshToken = async (token) => {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isActive: true
        }
      }
    }
  });

  if (!refreshToken) {
    return null;
  }

  if (refreshToken.isRevoked || refreshToken.expiresAt < new Date()) {
    return null;
  }

  return refreshToken;
};

// Verify password reset token
const verifyPasswordResetToken = async (token) => {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isActive: true
        }
      }
    }
  });

  if (!resetToken) {
    return null;
  }

  if (resetToken.isUsed || resetToken.expiresAt < new Date()) {
    return null;
  }

  return resetToken;
};

// Revoke refresh token
const revokeRefreshToken = async (token) => {
  return await prisma.refreshToken.update({
    where: { token },
    data: { isRevoked: true }
  });
};

// Mark password reset token as used
const markPasswordResetTokenAsUsed = async (token) => {
  return await prisma.passwordResetToken.update({
    where: { token },
    data: { isUsed: true }
  });
};

// Revoke all refresh tokens for a customer
const revokeAllUserTokens = async (customerId) => {
  return await prisma.refreshToken.updateMany({
    where: { customerId },
    data: { isRevoked: true }
  });
};

// Clean up expired refresh tokens
const cleanupExpiredTokens = async () => {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
  
  console.log(`Cleaned up ${result.count} expired refresh tokens`);
  return result.count;
};

// Clean up expired password reset tokens
const cleanupExpiredPasswordResetTokens = async () => {
  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isUsed: true }
      ]
    }
  });
  
  console.log(`Cleaned up ${result.count} expired/used password reset tokens`);
  return result.count;
};

// Generate token pair (access + refresh)
const generateTokenPair = async (customerId) => {
  const accessToken = generateAccessToken(customerId);
  const refreshToken = generateRefreshToken();
  
  // Set refresh token expiration from environment variable
  const expiresAt = new Date();
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  
  // Parse the expiration time (e.g., '7d' = 7 days)
  const match = refreshExpiresIn.match(/^(\d+)([dhms])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + value);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + value);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + value);
        break;
      case 's':
        expiresAt.setSeconds(expiresAt.getSeconds() + value);
        break;
      default:
        expiresAt.setDate(expiresAt.getDate() + 7); // Default to 7 days
    }
  } else {
    expiresAt.setDate(expiresAt.getDate() + 7); // Default to 7 days
  }
  
  // Store refresh token in database
  await createRefreshToken(customerId, refreshToken, expiresAt);
  
  return {
    accessToken,
    refreshToken,
    expiresAt
  };
};

// Generate password reset token
const generatePasswordResetTokenForCustomer = async (customerId) => {
  const resetToken = generatePasswordResetToken();
  
  // Set expiration to 1 hour from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  
  // Store reset token in database
  await createPasswordResetToken(customerId, resetToken, expiresAt);
  
  return {
    token: resetToken,
    expiresAt
  };
};

// Update customer's last login time
const updateLastLogin = async (customerId) => {
  return await prisma.customer.update({
    where: { id: customerId },
    data: { lastLoginAt: new Date() }
  });
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  hashPassword,
  comparePassword,
  createRefreshToken,
  createPasswordResetToken,
  verifyRefreshToken,
  verifyPasswordResetToken,
  revokeRefreshToken,
  markPasswordResetTokenAsUsed,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  cleanupExpiredPasswordResetTokens,
  generateTokenPair,
  generatePasswordResetTokenForCustomer,
  updateLastLogin,
  isValidEmail,
  validatePassword
}; 