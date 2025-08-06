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
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true; // Allow empty/undefined values
      }
      if (value.length < 2 || value.length > 100) {
        throw new Error('Company name must be between 2 and 100 characters');
      }
      return true;
    }),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
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
    .trim()
    .isLength({ min: 1 })
    .withMessage('State must be at least 1 character')
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

      console.log('Starting database transaction...');
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

        console.log('Database transaction completed successfully');
        return { customer, bankValidation: bankValidationResult };
      }, {
        maxWait: 5000, // 5 seconds max wait
        timeout: 15000  // 15 seconds timeout
      });

      // Extract results from transaction
      const { customer, bankValidation } = result;
      console.log('Extracted customer data from transaction');

      // Generate tokens
      console.log('Generating authentication tokens...');
      const tokens = await generateTokenPair(customer.id);
      console.log('Authentication tokens generated successfully');

      // Send welcome email asynchronously to avoid timeout
      const customerName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
      
      // Send email in background without blocking the response
      setImmediate(async () => {
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
      });

      console.log('Sending successful response to client...');
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
      console.log('Response sent successfully');

    } catch (error) {
      if (error.message === 'Customer with this email already exists') {
        return res.status(409).json({
          error: 'Customer with this email already exists',
          code: 'CUSTOMER_EXISTS'
        });
      }
      next(error);
    }
  }
);

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
      const bankValidationResult = bankValidationService.validateBankDetails({
        accountHolderName,
        bankCode,
        accountNumber,
        accountType
      }, countryCode);

      // Return validation result
      res.json({
        success: true,
        isValid: bankValidationResult.isValid,
        errors: bankValidationResult.errors,
        warnings: bankValidationResult.warnings,
        fieldValidation: bankValidationResult.fieldValidation,
        suggestions: bankValidationResult.suggestions,
        formattedBankCode: bankValidationService.formatBankCode(bankCode, countryCode),
        maskedAccountNumber: bankValidationService.maskAccountNumber(accountNumber)
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router; 