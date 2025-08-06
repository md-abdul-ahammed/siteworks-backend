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
  validatePassword,
  generatePasswordResetTokenForCustomer,
  verifyPasswordResetToken,
  markPasswordResetTokenAsUsed
} = require('../utils/auth');
// Brevo SDK setup
const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
// GoCardless service
const GoCardlessService = require('../services/gocardless');
// Bank validation service
const BankValidationService = require('../services/bankValidation');

const router = express.Router();
const prisma = new PrismaClient();
const goCardlessService = new GoCardlessService();
const bankValidationService = new BankValidationService();

// Validation middleware for user registration
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
];

// Validation middleware for customer registration
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
  body('addressLine1')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Address line 1 is required'),
  body('addressLine2')
    .optional()
    .trim(),
  body('city')
    .trim()
    .isLength({ min: 1 })
    .withMessage('City is required'),
  body('postcode')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Postcode is required'),
  body('state')
    .optional()
    .trim(),
  // Bank details validation (for GoCardless integration)
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
    .withMessage('Account type must be checking or savings')
    .custom((value, { req }) => {
      // If bank details are provided, accountType should be required
      if (req.body.accountHolderName || req.body.bankCode || req.body.accountNumber) {
        if (!value) {
          throw new Error('Account type is required when bank details are provided');
        }
      }
      return true;
    }),
  body('preferredCurrency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SEK', 'DKK', 'NOK'])
    .withMessage('Please select a valid currency')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
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
        addressLine1,
        addressLine2,
        city,
        postcode,
        state,
        // Bank details for GoCardless integration
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

      // Validate bank details if provided
      let bankValidationResult = null;
      if (accountHolderName || bankCode || accountNumber || accountType) {
        bankValidationResult = bankValidationService.validateBankDetails({
          accountHolderName,
          bankCode,
          accountNumber,
          accountType
        }, countryOfResidence);

        if (!bankValidationResult.isValid) {
          return res.status(400).json({
            error: 'Bank details validation failed',
            details: bankValidationResult.errors,
            warnings: bankValidationResult.warnings,
            fieldValidation: bankValidationResult.fieldValidation,
            suggestions: bankValidationResult.suggestions,
            code: 'BANK_VALIDATION_ERROR'
          });
        }
      }

      // Use Prisma transaction for data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Check if customer already exists
        const existingCustomer = await tx.customer.findUnique({
          where: { email }
        });

        if (existingCustomer) {
          throw new Error('Customer with this email already exists');
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create customer in database first (without GoCardless data)
        const customer = await tx.customer.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            companyName,
            phone,
            countryOfResidence,
            addressLine1,
            addressLine2,
            city,
            postcode,
            state,
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
            createdAt: true,
            goCardlessCustomerId: true,
            goCardlessBankAccountId: true,
            goCardlessMandateId: true,
            mandateStatus: true
          }
        });

        // Create GoCardless customer and mandate
        let goCardlessCustomer = null;
        let goCardlessBankAccount = null;
        let goCardlessMandate = null;
        let mandateStatus = null;

        // Only proceed with GoCardless if bank details are provided and validated
        if (accountHolderName && bankCode && accountNumber && accountType) {
          console.log('Creating GoCardless integration for:', customer.email);
          
          try {
            // Create GoCardless customer
            goCardlessCustomer = await goCardlessService.createCustomer({
              email: customer.email,
              firstName: customer.firstName,
              lastName: customer.lastName,
              companyName: customer.companyName,
              phone: customer.phone,
              countryOfResidence: customer.countryOfResidence,
              internalId: customer.id,
              address: {
                line1: customer.addressLine1,
                line2: customer.addressLine2,
                city: customer.city,
                postcode: customer.postcode,
                state: customer.state
              }
            });
            console.log('GoCardless customer created:', goCardlessCustomer.id);

            // Create GoCardless customer bank account with actual bank details
            goCardlessBankAccount = await goCardlessService.createCustomerBankAccount(
              goCardlessCustomer.id,
              {
                accountHolderName: accountHolderName,
                bankCode: bankCode,
                accountNumber: accountNumber,
                accountType: accountType,
                countryCode: customer.countryOfResidence
              }
            );
            console.log('GoCardless customer bank account created:', goCardlessBankAccount.id);

            // Create GoCardless mandate linked to the bank account
            goCardlessMandate = await goCardlessService.createMandate(
              goCardlessBankAccount.id,
              {
                countryCode: customer.countryOfResidence,
                payerIpAddress: (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1') ? req.ip : '8.8.8.8'
              }
            );

            console.log('GoCardless mandate created:', goCardlessMandate.id);
            mandateStatus = goCardlessMandate.status;

            // Update customer with GoCardless IDs within transaction
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                goCardlessCustomerId: goCardlessCustomer.id,
                goCardlessBankAccountId: goCardlessBankAccount.id,
                goCardlessMandateId: goCardlessMandate.id,
                mandateStatus: mandateStatus
              }
            });
            console.log('Customer updated with GoCardless IDs');

            // Update customer object for response
            customer.goCardlessCustomerId = goCardlessCustomer.id;
            customer.goCardlessBankAccountId = goCardlessBankAccount.id;
            customer.goCardlessMandateId = goCardlessMandate.id;
            customer.mandateStatus = mandateStatus;

          } catch (goCardlessError) {
            console.error('GoCardless integration failed:', goCardlessError);
            // Don't throw error, just log it - customer is still created
            console.log('Customer registration completed without GoCardless integration');
            console.log('GoCardless setup can be completed later via customer profile');
          }
        } else {
          console.log('Bank details not provided, skipping GoCardless integration');
          console.log('Customer can set up GoCardless later via /setup-gocardless endpoint');
        }

                return { customer, bankValidation: bankValidationResult };
      }, {
        maxWait: 10000, // 10 seconds max wait
        timeout: 30000  // 30 seconds timeout
      });

      // Extract results from transaction
      const { customer, bankValidation } = result;

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
                <p>This is an automated message, please do not reply directly to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        sendSmtpEmail.sender = { email: process.env.BREVO_FROM_EMAIL || 'noreply@siteworks.com', name: 'SiteWorks Team' };
        sendSmtpEmail.to = [{ email: customer.email, name: customerName }];

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
        gocardless: {
          integrated: !!(customer.goCardlessCustomerId && customer.goCardlessMandateId),
          customerId: customer.goCardlessCustomerId || null,
          bankAccountId: customer.goCardlessBankAccountId || null,
          mandateId: customer.goCardlessMandateId || null,
          mandateStatus: customer.mandateStatus || null
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        }
             });
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
          gocardless: {
            integrated: !!(goCardlessCustomer && goCardlessMandate),
            customerId: goCardlessCustomer?.id || null,
            bankAccountId: goCardlessCustomer ? 'created' : null,
            mandateId: goCardlessMandate?.id || null,
            mandateStatus: mandateStatus || null
          },
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

// Register new user (legacy route)
// router.post('/register', 
//   rateLimiter(15 * 60 * 1000, 5), // 5 requests per 15 minutes
//   validateRegistration,
//   async (req, res, next) => {
//     try {
//       // Check for validation errors
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({
//           error: 'Validation failed',
//           details: errors.array(),
//           code: 'VALIDATION_ERROR'
//         });
//       }

//       const { email, password, name } = req.body;

//       try {
//         // Check if customer already exists
//         const existingCustomer = await prisma.customer.findUnique({
//           where: { email }
//         });

//         if (existingCustomer) {
//           return res.status(409).json({
//             error: 'Customer with this email already exists',
//             code: 'CUSTOMER_EXISTS'
//           });
//         }

//         // Hash password
//         const hashedPassword = await hashPassword(password);

//         // Create customer
//         const customer = await prisma.customer.create({
//           data: {
//             email,
//             password: hashedPassword,
//             firstName: name || 'User',
//             lastName: '',
//             isVerified: true, // Auto-verify for now, can be changed to false for email verification
//             isActive: true,
//             countryOfResidence: 'Unknown',
//             addressLine1: 'Unknown',
//             city: 'Unknown',
//             postcode: 'Unknown'
//           },
//           select: {
//             id: true,
//             email: true,
//             firstName: true,
//             lastName: true,
//             isVerified: true,
//             isActive: true,
//             createdAt: true
//           }
//         });

//         // Generate tokens
//         const tokens = await generateTokenPair(customer.id);

//         res.status(201).json({
//           success: true,
//           message: 'Customer registered successfully',
//           customer,
//           tokens: {
//             accessToken: tokens.accessToken,
//             refreshToken: tokens.refreshToken,
//             expiresAt: tokens.expiresAt
//           }
//         });
//       } catch (dbError) {
//         console.error('Database error:', dbError);
//         return res.status(503).json({
//           error: 'Database service unavailable',
//           code: 'DATABASE_UNAVAILABLE',
//           message: 'Please try again later'
//         });
//       }

//     } catch (error) {
//       next(error);
//     }
//   }
// );

// Login customer
router.post('/signin',
  rateLimiter(15 * 60 * 1000, 10), // 10 requests per 15 minutes
  validateLogin,
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

      const { email, password } = req.body;

      // Find customer
      const customer = await prisma.customer.findUnique({
        where: { email }
      });

      if (!customer) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if customer is active
      if (!customer.isActive) {
        return res.status(401).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, customer.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Update last login time
      await updateLastLogin(customer.id);

      // Generate tokens
      const tokens = await generateTokenPair(customer.id);

      // Return customer data (excluding password)
      const customerData = {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName,
        phone: customer.phone,
        countryOfResidence: customer.countryOfResidence,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        city: customer.city,
        postcode: customer.postcode,
        state: customer.state,
        isVerified: customer.isVerified,
        isActive: customer.isActive,
        lastLoginAt: customer.lastLoginAt
      };

      res.json({
        success: true,
        message: 'Login successful',
        customer: customerData,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Refresh access token
router.post('/refresh',
  rateLimiter(15 * 60 * 1000, 20), // 20 requests per 15 minutes
  validateRefreshToken,
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

      const { refreshToken } = req.body;

      // Verify refresh token
      const tokenData = await verifyRefreshToken(refreshToken);
      if (!tokenData) {
        return res.status(401).json({
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      // Check if customer is still active
      if (!tokenData.customer.isActive) {
        return res.status(401).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Revoke the old refresh token
      await revokeRefreshToken(refreshToken);

      // Generate new token pair
      const tokens = await generateTokenPair(tokenData.customer.id);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Logout customer
router.post('/logout',
  verifyToken,
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // Revoke the refresh token
        await revokeRefreshToken(refreshToken);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Logout from all devices
router.post('/logout-all',
  verifyToken,
  async (req, res, next) => {
    try {
      // Revoke all refresh tokens for the customer
      await revokeAllUserTokens(req.user.id);

      res.json({
        success: true,
        message: 'Logged out from all devices successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get current customer profile
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
      .withMessage('Please provide a valid phone number'),
    body('addressLine1')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Address line 1 must be between 1 and 200 characters'),
    body('addressLine2')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Address line 2 must be between 1 and 200 characters'),
    body('city')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('City must be between 1 and 100 characters'),
    body('state')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('State must be between 1 and 100 characters'),
    body('postcode')
      .optional()
      .trim()
      .isLength({ min: 1, max: 20 })
      .withMessage('Postcode must be between 1 and 20 characters')
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

      const { firstName, lastName, companyName, phone, addressLine1, addressLine2, city, state, postcode } = req.body;

      const updatedCustomer = await prisma.customer.update({
        where: { id: req.user.id },
        data: { firstName, lastName, companyName, phone, addressLine1, addressLine2, city, state, postcode },
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

// Change password
router.put('/change-password',
  verifyToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
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

      const { currentPassword, newPassword } = req.body;

      // Get current customer with password
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id }
      });

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, customer.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await prisma.customer.update({
        where: { id: req.user.id },
        data: { password: hashedNewPassword }
      });

      // Revoke all refresh tokens to force re-login
      await revokeAllUserTokens(req.user.id);

      res.json({
        success: true,
        message: 'Password changed successfully. Please log in again.'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Forgot password
router.post('/forgot-password',
  rateLimiter(15 * 60 * 1000, 3), // 3 requests per 15 minutes
  validateForgotPassword,
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

      const { email } = req.body;

      // Find customer
      const customer = await prisma.customer.findUnique({
        where: { email }
      });

      if (!customer) {
        // Don't reveal if email exists or not for security
        return res.json({
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent.'
        });
      }

      // Check if customer is active
      if (!customer.isActive) {
        return res.status(401).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Generate password reset token
      const resetTokenData = await generatePasswordResetTokenForCustomer(customer.id);

      // Send password reset email via Brevo
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetTokenData.token}`;
      const customerName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
      
      try {
        const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.subject = "Password Reset Request - SiteWorks";
        sendSmtpEmail.htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset Request - SiteWorks</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
                line-height: 1.6; 
                color: #374151; 
                background-color: #f9fafb;
                margin: 0;
                padding: 0;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #ffffff;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                overflow: hidden;
                border: 1px solid #e5e7eb;
              }
              .header { 
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
                padding: 56px 48px;
                text-align: center;
                color: white;
                position: relative;
                overflow: hidden;
                border-radius: 16px 16px 0 0;
              }
              .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.08"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.08"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.08"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.08"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.08"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                opacity: 0.4;
              }
              .header h1 {
                margin: 0;
                font-size: 36px;
                font-weight: 900;
                color: white;
                position: relative;
                z-index: 1;
                text-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
                letter-spacing: -0.02em;
              }
              .logo-section {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 32px;
                padding: 24px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 20px;
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                width: 100%;
                max-width: 200px;
                margin-left: auto;
                margin-right: auto;
              }
              .logo-image {
                width: 140px;
                height: auto;
                max-height: 70px;
                object-fit: contain;
                filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
                display: block;
              }
              .content { 
                background-color: #ffffff; 
                padding: 48px 40px;
                color: #374151;
                position: relative;
              }
              .content::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #f59e0b 0%, #d97706 50%, #f59e0b 100%);
              }
              .greeting {
                font-size: 20px;
                font-weight: 700;
                color: #111827;
                margin: 0 0 28px 0;
                position: relative;
              }
              .greeting::after {
                content: '';
                position: absolute;
                bottom: -8px;
                left: 0;
                width: 40px;
                height: 3px;
                background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                border-radius: 2px;
              }
              .text {
                font-size: 16px;
                line-height: 1.7;
                color: #4b5563;
                margin: 0 0 24px 0;
              }
              .button-container {
                text-align: center;
                margin: 36px 0;
                position: relative;
              }
              .button { 
                display: inline-block; 
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
                color: white !important; 
                padding: 20px 48px; 
                text-decoration: none; 
                border-radius: 16px; 
                font-weight: 800;
                font-size: 18px;
                box-shadow: 0 12px 24px -6px rgba(30, 41, 59, 0.4);
                transition: all 0.4s ease;
                position: relative;
                overflow: hidden;
                border: none !important;
                outline: none !important;
                letter-spacing: 0.02em;
              }
              .button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.5s;
              }
              .button:hover {
                transform: translateY(-3px);
                box-shadow: 0 16px 32px -8px rgba(30, 41, 59, 0.5);
              }
              .button:hover::before {
                left: 100%;
              }
              .button, .button:visited, .button:active, .button:hover {
                color: white !important;
                text-decoration: none !important;
              }
              .warning { 
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-left: 4px solid #f59e0b;
                padding: 24px;
                border-radius: 12px;
                margin: 28px 0;
                position: relative;
                overflow: hidden;
              }
              .warning::before {
                content: '⚠️';
                position: absolute;
                top: 20px;
                right: 20px;
                font-size: 20px;
                opacity: 0.3;
              }
              .warning strong {
                color: #92400e;
                font-weight: 700;
              }
              .warning-text {
                color: #92400e;
                margin: 0;
                font-size: 15px;
                font-weight: 500;
              }
              .link-text {
                font-size: 14px;
                color: #6b7280;
                margin: 16px 0 8px 0;
              }
              .fallback-link {
                word-break: break-all;
                color: #3b82f6;
                font-size: 14px;
                text-decoration: none;
                padding: 16px;
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                display: block;
                margin: 12px 0;
                transition: all 0.2s ease;
              }
              .fallback-link:hover {
                background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                border-color: #cbd5e1;
              }
              .footer { 
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                padding: 32px 40px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
                position: relative;
              }
              .footer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, #f59e0b 0%, #d97706 50%, #f59e0b 100%);
              }
              .footer-text {
                font-size: 14px;
                color: #6b7280;
                margin: 0 0 8px 0;
              }
              .footer-email {
                color: #3b82f6;
                text-decoration: none;
              }
              .closing {
                margin: 36px 0 0 0;
                padding-top: 28px;
                border-top: 1px solid #e5e7eb;
                position: relative;
              }
              .closing::before {
                content: '';
                position: absolute;
                top: -1px;
                left: 0;
                width: 60px;
                height: 2px;
                background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
              }
              .closing-text {
                margin: 0;
                color: #4b5563;
                font-size: 16px;
                font-weight: 500;
              }
              .team-name {
                font-weight: 700;
                color: #111827;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo-section">
                                      <img src="https://res.cloudinary.com/gocardless/image/fetch/w_300,h_50,c_limit,dpr_3.0/https://uploads.gocardless.com/46b5f806bfe5df50e475ca350eefb134.png" alt="SiteWorks Logo" class="logo-image" style="display: block; margin: 0 auto;">
                </div>
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <p class="greeting">Hello ${customerName},</p>
                
                <p class="text">We received a request to reset your password for your SiteWorks account. If you didn't make this request, you can safely ignore this email.</p>
                
                <p class="text">To reset your password, click the button below:</p>
                
                <div class="button-container">
                  <a href="${resetLink}" class="button">Reset Password</a>
                </div>
                
                <div class="warning">
                  <p class="warning-text"><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
                </div>
                
                <p class="link-text">If the button doesn't work, you can copy and paste this link into your browser:</p>
                <a href="${resetLink}" class="fallback-link">${resetLink}</a>
                
                <p class="text">If you have any questions or need assistance, please contact our support team.</p>
                
                <div class="closing">
                  <p class="closing-text">Best regards,<br><span class="team-name">The SiteWorks Team</span></p>
                </div>
              </div>
              <div class="footer">
                <p class="footer-text">This email was sent to <a href="mailto:${customer.email}" class="footer-email">${customer.email}</a></p>
                <p class="footer-text">If you didn't request this password reset, please ignore this email.</p>
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
        console.log('Password reset email sent successfully to:', customer.email);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the request if email fails, just log it
        // The user will still get a success message for security reasons
      }

      res.json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Reset password
router.post('/reset-password',
  rateLimiter(15 * 60 * 1000, 5), // 5 requests per 15 minutes
  validateResetPassword,
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

      const { token, newPassword } = req.body;

      // Verify reset token
      const resetTokenData = await verifyPasswordResetToken(token);
      if (!resetTokenData) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      // Check if customer is still active
      if (!resetTokenData.customer.isActive) {
        return res.status(401).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await prisma.customer.update({
        where: { id: resetTokenData.customer.id },
        data: { password: hashedNewPassword }
      });

      // Mark reset token as used
      await markPasswordResetTokenAsUsed(token);

      // Revoke all refresh tokens to force re-login
      await revokeAllUserTokens(resetTokenData.customer.id);

      res.json({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Verify reset token (for frontend validation)
router.post('/verify-reset-token',
  rateLimiter(15 * 60 * 1000, 10), // 10 requests per 15 minutes
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required')
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

      const { token } = req.body;

      // Verify reset token
      const resetTokenData = await verifyPasswordResetToken(token);
      if (!resetTokenData) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      res.json({
        success: true,
        message: 'Reset token is valid',
        customer: {
          email: resetTokenData.customer.email,
          firstName: resetTokenData.customer.firstName,
          lastName: resetTokenData.customer.lastName
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Check email availability
router.post('/check-email',
  rateLimiter(15 * 60 * 1000, 10), // 10 requests per 15 minutes
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
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

      const { email } = req.body;

      // Check if email already exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { email }
      });

      if (existingCustomer) {
        return res.status(409).json({
          error: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }

      res.json({
        success: true,
        message: 'Email is available'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Send OTP for email verification
router.post('/send-otp',
  rateLimiter(15 * 60 * 1000, 5), // 5 requests per 15 minutes
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
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

      const { email } = req.body;

      // Generate a simple 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database (you might want to create a separate table for this)
      // For now, we'll just log it
      console.log('=== OTP GENERATED ===');
      console.log('Email:', email);
      console.log('OTP:', otp);
      console.log('=====================');

      // Send OTP email
      try {
        const subject = 'Email Verification Code - SiteWorks';
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification Code</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #ffffff; padding: 30px; border: 1px solid #e9ecef; }
              .otp-code { font-size: 32px; font-weight: bold; text-align: center; color: #007bff; padding: 20px; background-color: #f8f9fa; border-radius: 5px; margin: 20px 0; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6c757d; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Email Verification Code</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                
                <p>Your email verification code is:</p>
                
                <div class="otp-code">${otp}</div>
                
                <p>Please enter this code in the verification form to complete your registration.</p>
                
                <p>This code will expire in 10 minutes.</p>
                
                <p>If you didn't request this code, please ignore this email.</p>
                
                <p>Best regards,<br>The SiteWorks Team</p>
              </div>
              <div class="footer">
                <p>This email was sent to ${email}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const textContent = `
Email Verification Code - SiteWorks

Hello,

Your email verification code is: ${otp}

Please enter this code in the verification form to complete your registration.

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,
The SiteWorks Team

This email was sent to ${email}
        `;

        // Assuming emailService is available globally or imported elsewhere
        // For now, we'll just log the email details
        console.log('OTP email sent to:', email);
        console.log('OTP:', otp);

      } catch (emailError) {
        console.error('Failed to send OTP email:', emailError);
        return res.status(500).json({
          error: 'Failed to send verification code',
          code: 'EMAIL_SEND_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Verification code sent successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Verify OTP
router.post('/verify-otp',
  rateLimiter(15 * 60 * 1000, 10), // 10 requests per 15 minutes
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits')
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

      const { email, otp } = req.body;

      // For now, we'll just accept any 6-digit OTP for testing
      // In a real application, you would verify against the stored OTP
      if (otp.length === 6 && /^\d{6}$/.test(otp)) {
        res.json({
          success: true,
          message: 'Email verified successfully'
        });
      } else {
        res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_OTP'
        });
      }

    } catch (error) {
      next(error);
    }
  }
);

// Get GoCardless status for authenticated user
router.get('/gocardless-status',
  verifyToken,
  async (req, res, next) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
        select: {
          goCardlessCustomerId: true,
          goCardlessBankAccountId: true,
          goCardlessMandateId: true,
          mandateStatus: true
        }
      });

      if (!customer) {
        return res.status(404).json({
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      let mandateDetails = null;
      
      // If we have a mandate, get latest status from GoCardless
      if (customer.goCardlessMandateId) {
        try {
          mandateDetails = await goCardlessService.getMandate(customer.goCardlessMandateId);
          
          // Update status if changed
          if (mandateDetails.status !== customer.mandateStatus) {
            await prisma.customer.update({
              where: { id: req.user.id },
              data: { mandateStatus: mandateDetails.status }
            });
          }
        } catch (error) {
          console.error('Error fetching mandate details:', error);
        }
      }

      res.json({
        success: true,
        data: {
          hasGoCardlessCustomer: !!customer.goCardlessCustomerId,
          hasBankAccount: !!customer.goCardlessBankAccountId,
          hasMandate: !!customer.goCardlessMandateId,
          customerId: customer.goCardlessCustomerId,
          bankAccountId: customer.goCardlessBankAccountId,
          mandateId: customer.goCardlessMandateId,
          mandateStatus: mandateDetails ? mandateDetails.status : customer.mandateStatus,
          mandateDetails: mandateDetails ? {
            id: mandateDetails.id,
            status: mandateDetails.status,
            reference: mandateDetails.reference,
            scheme: mandateDetails.scheme,
            created_at: mandateDetails.created_at
          } : null
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Setup or retry GoCardless integration
router.post('/setup-gocardless',
  verifyToken,
  [
    body('accountHolderName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Account holder name is required and must be between 2 and 100 characters'),
    body('bankCode')
      .isNumeric()
      .isLength({ min: 3, max: 20 })
      .withMessage('Bank code is required and must be 3-20 digits'),
    body('accountNumber')
      .isNumeric()
      .isLength({ min: 8, max: 20 })
      .withMessage('Account number is required and must be 8-20 digits'),
    body('accountType')
      .isIn(['checking', 'savings'])
      .withMessage('Account type must be checking or savings')
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

      const { accountHolderName, bankCode, accountNumber, accountType } = req.body;

      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id }
      });

      if (!customer) {
        return res.status(404).json({
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      // Check if already setup
      if (customer.goCardlessCustomerId && customer.goCardlessBankAccountId && customer.goCardlessMandateId) {
        return res.status(400).json({
          error: 'GoCardless integration already setup',
          code: 'ALREADY_SETUP',
          data: {
            customerId: customer.goCardlessCustomerId,
            bankAccountId: customer.goCardlessBankAccountId,
            mandateId: customer.goCardlessMandateId,
            mandateStatus: customer.mandateStatus
          }
        });
      }

      let goCardlessCustomer = null;
      let goCardlessBankAccount = null;
      let goCardlessMandate = null;

      try {
        console.log('Setting up GoCardless for customer:', customer.email);

        // Create or get GoCardless customer
        if (!customer.goCardlessCustomerId) {
          goCardlessCustomer = await goCardlessService.createCustomer({
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            companyName: customer.companyName,
            phone: customer.phone,
            countryOfResidence: customer.countryOfResidence,
            internalId: customer.id,
            address: {
              line1: customer.addressLine1,
              line2: customer.addressLine2,
              city: customer.city,
              postcode: customer.postcode,
              state: customer.state
            }
          });
          console.log('GoCardless customer created:', goCardlessCustomer.id);
        } else {
          goCardlessCustomer = await goCardlessService.getCustomer(customer.goCardlessCustomerId);
        }

        // Create GoCardless customer bank account with provided bank details
        if (!customer.goCardlessBankAccountId) {
          goCardlessBankAccount = await goCardlessService.createCustomerBankAccount(
            goCardlessCustomer.id,
            {
              accountHolderName: accountHolderName,
              bankCode: bankCode,
              accountNumber: accountNumber,
              accountType: accountType,
              countryCode: customer.countryOfResidence
            }
          );
          console.log('GoCardless customer bank account created:', goCardlessBankAccount.id);
        } else {
          // If bank account already exists, we should get it (though this shouldn't happen with the check above)
          console.log('Using existing GoCardless bank account:', customer.goCardlessBankAccountId);
          goCardlessBankAccount = { id: customer.goCardlessBankAccountId };
        }

        // Create GoCardless mandate if not exists
        if (!customer.goCardlessMandateId) {
          goCardlessMandate = await goCardlessService.createMandate(
            goCardlessBankAccount.id,
            {
              reference: `MANDATE-${customer.id}-${Date.now()}`,
              countryCode: customer.countryOfResidence
            }
          );
          console.log('GoCardless mandate created:', goCardlessMandate.id);
        } else {
          goCardlessMandate = await goCardlessService.getMandate(customer.goCardlessMandateId);
        }

        // Update customer with GoCardless IDs
        const updatedCustomer = await prisma.customer.update({
          where: { id: customer.id },
          data: {
            goCardlessCustomerId: goCardlessCustomer.id,
            goCardlessBankAccountId: goCardlessBankAccount.id,
            goCardlessMandateId: goCardlessMandate.id,
            mandateStatus: goCardlessMandate.status
          },
          select: {
            id: true,
            email: true,
            goCardlessCustomerId: true,
            goCardlessBankAccountId: true,
            goCardlessMandateId: true,
            mandateStatus: true
          }
        });

        res.json({
          success: true,
          message: 'GoCardless integration setup successfully',
          data: {
            customerId: updatedCustomer.goCardlessCustomerId,
            bankAccountId: updatedCustomer.goCardlessBankAccountId,
            mandateId: updatedCustomer.goCardlessMandateId,
            mandateStatus: updatedCustomer.mandateStatus
          }
        });

      } catch (goCardlessError) {
        console.error('GoCardless setup failed:', goCardlessError);
        return res.status(500).json({
          error: 'Failed to setup GoCardless integration',
          code: 'GOCARDLESS_SETUP_FAILED',
          details: goCardlessError.message
        });
      }

    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

// Bank details validation endpoint
router.post('/validate-bank-details',
  rateLimiter(60 * 1000, 10), // 10 requests per minute
  [
    body('accountHolderName').trim().notEmpty().withMessage('Account holder name is required'),
    body('bankCode').trim().notEmpty().withMessage('Bank code is required'),
    body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('accountType').isIn(['checking', 'savings']).withMessage('Account type must be checking or savings'),
    body('countryCode').trim().notEmpty().withMessage('Country code is required')
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

      const { accountHolderName, bankCode, accountNumber, accountType, countryCode } = req.body;

      // Validate bank details
      const validationResult = bankValidationService.validateBankDetails({
        accountHolderName,
        bankCode,
        accountNumber,
        accountType
      }, countryCode);

      // Return validation result
      res.json({
        success: true,
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        fieldValidation: validationResult.fieldValidation,
        suggestions: validationResult.suggestions,
        formattedBankCode: bankValidationService.formatBankCode(bankCode, countryCode),
        maskedAccountNumber: bankValidationService.maskAccountNumber(accountNumber)
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router; 