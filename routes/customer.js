const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { 
  verifyToken, 
  rateLimiter, 
  errorHandler 
} = require('../middleware/auth');
const {
  hashPassword,
  comparePassword,
  generateTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  updateLastLogin,
  isValidEmail,
  validatePassword
} = require('../utils/auth');
// Brevo SDK setup
const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const router = express.Router();
const prisma = new PrismaClient();

// Validation middleware for comprehensive customer registration
const validateCustomerRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('countryOfResidence')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Country of residence is required'),
  body('address.line1')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Address line 1 is required'),
  body('address.line2')
    .optional()
    .trim(),
  body('address.city')
    .trim()
    .isLength({ min: 1 })
    .withMessage('City is required'),
  body('address.postcode')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Postcode is required'),
  body('address.state')
    .optional()
    .trim(),
  // Bank details validation (for console logging only)
  body('accountHolderName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name must be between 2 and 100 characters'),
  body('bankCode')
    .optional()
    .isNumeric()
    .isLength({ min: 3, max: 20 })
    .withMessage('Bank code must be 3-20 digits'),
  body('accountNumber')
    .optional()
    .isNumeric()
    .isLength({ min: 8, max: 20 })
    .withMessage('Account number must be 8-20 digits'),
  body('accountType')
    .optional()
    .isIn(['checking', 'savings'])
    .withMessage('Account type must be checking or savings'),
  body('preferredCurrency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SEK', 'DKK', 'NOK'])
    .withMessage('Please select a valid currency')
];

// Register new customer with comprehensive details
router.post('/register', 
  rateLimiter(15 * 60 * 1000, 5), // 5 requests per 15 minutes
  validateCustomerRegistration,
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        companyName,
        phone,
        countryOfResidence,
        address,
        // Bank details for console logging
        accountHolderName,
        bankCode,
        accountNumber,
        accountType,
        preferredCurrency
      } = req.body;

      // Console log bank details as requested
      if (accountHolderName || bankCode || accountNumber || accountType || preferredCurrency) {
        console.log('=== BANK DETAILS (CONSOLE LOGGED) ===');
        console.log('Account Holder Name:', accountHolderName);
        console.log('Bank Code:', bankCode);
        console.log('Account Number:', accountNumber);
        console.log('Account Type:', accountType);
        console.log('Preferred Currency:', preferredCurrency);
        console.log('=====================================');
      }

      try {
        // Check if customer already exists
        const existingCustomer = await prisma.customer.findUnique({
          where: { email }
        });

        if (existingCustomer) {
          return res.status(409).json({
            error: 'Customer with this email already exists',
            code: 'CUSTOMER_EXISTS'
          });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create customer (without storing bank details)
        const customer = await prisma.customer.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            companyName,
            phone,
            countryOfResidence,
            addressLine1: address.line1,
            addressLine2: address.line2,
            city: address.city,
            postcode: address.postcode,
            state: address.state,
            isVerified: true, // Auto-verify for now, can be changed to false for email verification
            isActive: true
          },
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
            isActive: true,
            createdAt: true
          }
        });

        // Generate tokens
        const tokens = await generateTokenPair(customer.id);

        // Send welcome email
        const customerName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
        try {
          const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
          
          const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
          sendSmtpEmail.subject = "Welcome to SiteWorks!";
          sendSmtpEmail.htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Welcome to SiteWorks</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #ffffff; padding: 30px; border: 1px solid #e9ecef; }
                .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6c757d; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to SiteWorks!</h1>
                </div>
                <div class="content">
                  <p>Hello ${customerName},</p>
                  
                  <p>Welcome to SiteWorks! We're excited to have you on board.</p>
                  
                  <p>Your account has been successfully created and you can now access all our services.</p>
                  
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">Access Your Dashboard</a>
                  </div>
                  
                  <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                  
                  <p>Best regards,<br>The SiteWorks Team</p>
                </div>
                <div class="footer">
                  <p>Thank you for choosing SiteWorks!</p>
                </div>
              </div>
            </body>
            </html>
          `;
          sendSmtpEmail.sender = {
            name: process.env.BREVO_SENDER_NAME || "SiteWorks",
            email: process.env.BREVO_SENDER_EMAIL
          };
          sendSmtpEmail.to = [{ email: customer.email }];

          await apiInstance.sendTransacEmail(sendSmtpEmail);
          console.log('Welcome email sent successfully to:', customer.email);
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail registration if email fails
        }

        res.status(201).json({
          success: true,
          message: 'Customer registered successfully',
          customer,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt
          }
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(503).json({
          error: 'Database service unavailable',
          code: 'DATABASE_UNAVAILABLE',
          message: 'Please try again later'
        });
      }

    } catch (error) {
      next(error);
    }
  }
);

// Get customer profile
router.get('/profile',
  verifyToken,
  async (req, res, next) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
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
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({
        success: true,
        customer
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update customer profile
router.put('/profile',
  verifyToken,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('companyName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Company name must be between 1 and 100 characters'),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number')
  ],
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array(),
          code: 'VALIDATION_ERROR'
        });
      }

      const { firstName, lastName, companyName, phone } = req.body;

      const updatedCustomer = await prisma.customer.update({
        where: { id: req.user.id },
        data: { firstName, lastName, companyName, phone },
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
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        customer: updatedCustomer
      });

    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

module.exports = router; 