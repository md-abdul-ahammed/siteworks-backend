const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Prisma client setup
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log("BREVO_API_KEY", process.env.BREVO_API_KEY);

// Test database connection
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((error) => {
    console.warn('⚠️ Database connection failed:', error.message);
    console.log('📝 You can set up the database later using: npx prisma db push');
  });

// Brevo SDK setup
const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

console.log(process.env.BREVO_API_KEY);

// Import middleware and routes
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
app.use(rateLimiter(15 * 60 * 1000, 100)); // 100 requests per 15 minutes

// In-memory storage for OTP (in production, use Redis or database)
const otpStorage = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Brevo
const sendOTPEmail = async (email, otp) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Your SiteWorks Verification Code";
    sendSmtpEmail.htmlContent = `
      <html>
        <body>
          <h2>Email Verification</h2>
          <p>Your verification code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </body>
      </html>
    `;
    sendSmtpEmail.sender = {
      name: process.env.BREVO_SENDER_NAME || "SiteWorks",
      email: process.env.BREVO_SENDER_EMAIL
    };
    sendSmtpEmail.to = [{ email: email }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to the SiteWorks Backend API!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

// Check email existence endpoint
app.post('/api/check-email', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    // Check if email exists in database
    const existingCustomer = await prisma.customer.findUnique({
      where: { email }
    });

    if (existingCustomer) {
      return res.status(409).json({
        error: 'Email is already taken',
        code: 'EMAIL_EXISTS',
        exists: true
      });
    }

    res.json({ 
      success: true, 
      message: 'Email is available',
      exists: false,
      email: email 
    });

  } catch (error) {
    next(error);
  }
});

// Send OTP endpoint
app.post('/api/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    // Check if email already exists before sending OTP
    const existingCustomer = await prisma.customer.findUnique({
      where: { email }
    });

    if (existingCustomer) {
      return res.status(409).json({
        error: 'Email is already taken',
        code: 'EMAIL_EXISTS'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (10 minutes)
    const expirationTime = Date.now() + (10 * 60 * 1000); // 10 minutes
    otpStorage.set(email, {
      otp: otp,
      expiresAt: expirationTime
    });

    // Send email via Brevo
    await sendOTPEmail(email, otp);

    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      email: email 
    });

  } catch (error) {
    next(error);
  }
});

// Verify OTP endpoint
app.post('/api/verify-otp', (req, res, next) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required',
        code: 'MISSING_FIELDS'
      });
    }

    const storedData = otpStorage.get(email);
    
    if (!storedData) {
      return res.status(400).json({ 
        error: 'No OTP found for this email',
        code: 'OTP_NOT_FOUND'
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(email);
      return res.status(400).json({ 
        error: 'OTP has expired',
        code: 'OTP_EXPIRED'
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      return res.status(400).json({ 
        error: 'Invalid OTP',
        code: 'INVALID_OTP'
      });
    }

    // Remove OTP from storage after successful verification
    otpStorage.delete(email);

    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      email: email 
    });

  } catch (error) {
    next(error);
  }
});

// Cleanup expired tokens periodically (every hour)
setInterval(async () => {
  try {
    const { cleanupExpiredTokens } = require('./utils/auth');
    await cleanupExpiredTokens();
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// Global error handling middleware
app.use(errorHandler);

// 404 handler
app.use('/*', notFoundHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
  console.log(`🔐 Authentication endpoints available at: http://localhost:${PORT}/api/auth`);
  console.log(`👥 Customer endpoints available at: http://localhost:${PORT}/api/customers`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
}); 