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
// GoCardless service
const GoCardlessService = require('../services/gocardless');

const router = express.Router();
const prisma = new PrismaClient();
const goCardlessService = new GoCardlessService();

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

        // Create customer in database first (without GoCardless data)
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
            createdAt: true,
            goCardlessCustomerId: true,
            goCardlessBankAccountId: true,
            goCardlessMandateId: true,
            mandateStatus: true
          }
        });
        console.log('Customer created:', customer);

        // Create GoCardless customer and mandate
        let goCardlessCustomer = null;
        let goCardlessMandate = null;
        let mandateStatus = null;

        try {
          console.log('Creating GoCardless integration for:', customer.email);
          
          // Only proceed with GoCardless if bank details are provided
          if (accountHolderName && bankCode && accountNumber) {
            console.log('Bank details provided, creating GoCardless customer and bank account');
            
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
            console.log('GoCardless customer created:', goCardlessCustomer);
            console.log('GoCardless customer created:', goCardlessCustomer.id);

            // Create GoCardless customer bank account with actual bank details
            const goCardlessBankAccount = await goCardlessService.createCustomerBankAccount(
              goCardlessCustomer.id,
              {
                accountHolderName: accountHolderName,
                bankCode: bankCode,
                accountNumber: accountNumber,
                accountType: accountType || 'checking',
                countryCode: customer.countryOfResidence
              }
            );
            console.log('GoCardless customer bank account created:', goCardlessBankAccount);

            console.log('GoCardless customer bank account created:', goCardlessBankAccount.id);

            // Create GoCardless mandate linked to the bank account
            goCardlessMandate = await goCardlessService.createMandate(
              goCardlessBankAccount.id,
              {
                reference: `MANDATE-${customer.id}-${Date.now()}`,
                scheme: customer.countryOfResidence === 'GB' ? 'bacs' : 'sepa_core'
              }
            );

            console.log('GoCardless mandate created:', goCardlessMandate.id);
            mandateStatus = goCardlessMandate.status;
            console.log('GoCardless mandate created:', goCardlessMandate);

            // Update customer with GoCardless IDs
            await prisma.customer.update({
              where: { id: customer.id },
              data: {
                goCardlessCustomerId: goCardlessCustomer.id,
                goCardlessBankAccountId: goCardlessBankAccount.id,
                goCardlessMandateId: goCardlessMandate.id,
                mandateStatus: mandateStatus
              }
            });
            console.log('Customer updated with GoCardless IDs:', customer);

            // Update customer object for response
            customer.goCardlessCustomerId = goCardlessCustomer.id;
            customer.goCardlessBankAccountId = goCardlessBankAccount.id;
            customer.goCardlessMandateId = goCardlessMandate.id;
            customer.mandateStatus = mandateStatus;
          } else {
            console.log('Bank details not provided, skipping GoCardless integration');
            console.log('Customer can set up GoCardless later via /setup-gocardless endpoint');
          }

        } catch (goCardlessError) {
          console.error('GoCardless integration failed:', goCardlessError);
          
          // Log the error but don't fail the registration
          // The customer is already created, we'll handle GoCardless setup later
          console.log('Customer registration completed without GoCardless integration');
          console.log('GoCardless setup can be completed later via customer profile');
        }

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
          updatedAt: true,
          goCardlessCustomerId: true,
          goCardlessBankAccountId: true,
          goCardlessMandateId: true,
          mandateStatus: true
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
          updatedAt: true,
          goCardlessCustomerId: true,
          goCardlessBankAccountId: true,
          goCardlessMandateId: true,
          mandateStatus: true
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
      .optional()
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
              accountType: accountType || 'checking',
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
              scheme: customer.countryOfResidence === 'GB' ? 'bacs' : 'sepa_core'
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

// Get GoCardless mandate status
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

// Apply error handler
router.use(errorHandler);

module.exports = router; 