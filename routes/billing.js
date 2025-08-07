const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { 
  verifyToken, 
  rateLimiter, 
  errorHandler 
} = require('../middleware/auth');
const BillingIntegrationService = require('../services/billingIntegration');

const router = express.Router();
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});
const billingService = new BillingIntegrationService();

// Database health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Database operation with retry logic
const executeWithRetry = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      
      if (error.code === 'P1001' && attempt < maxRetries) {
        // Database connection error, wait and retry
        console.log(`Retrying database operation in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
};

// Rate limiting for sync endpoint (max 10 requests per 5 minutes per user)
const syncRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many sync requests, please try again later',
  keyGenerator: (req) => req.user?.id || req.ip // Use user ID if authenticated, otherwise IP
});

// Sync billing data from Zoho for the logged-in user
router.post('/sync',
  verifyToken,
  syncRateLimiter,
  async (req, res, next) => {
    try {
      console.log('🔄 Syncing billing data for user:', req.user.id);
      
      const result = await billingService.syncBillingData(req.user.id);
      
      res.json({
        success: true,
        message: 'Billing data synced successfully',
        data: result
      });

    } catch (error) {
      console.error('Error syncing billing data:', error);
      res.status(500).json({
        error: 'Failed to sync billing data',
        message: error.message
      });
    }
  }
);

// Get billing history for customer
router.get('/history',
  verifyToken,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'failed', 'cancelled'])
      .withMessage('Status must be pending, paid, failed, or cancelled')
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

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;
      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = {
        customerId: req.user.id
      };

      if (status) {
        whereClause.status = status;
      }

      // Get billing history with receipts count using retry logic
      const billingHistory = await executeWithRetry(async () => {
        return await prisma.billingHistory.findMany({
          where: whereClause,
          include: {
            receipts: {
              select: {
                id: true,
                fileName: true,
                fileUrl: true,
                isDownloaded: true,
                createdAt: true
              }
            },
            _count: {
              select: {
                receipts: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: limit
        });
      });

      // Get total count for pagination using retry logic
      const totalCount = await executeWithRetry(async () => {
        return await prisma.billingHistory.count({
          where: whereClause
        });
      });

      // Calculate summary statistics using retry logic
      const summary = await executeWithRetry(async () => {
        return await prisma.billingHistory.aggregate({
          where: whereClause,
          _sum: {
            amount: true
          },
          _count: {
            id: true
          }
        });
      });

      const paidAmount = await executeWithRetry(async () => {
        return await prisma.billingHistory.aggregate({
          where: {
            ...whereClause,
            status: 'paid'
          },
          _sum: {
            amount: true
          }
        });
      });

      res.json({
        success: true,
        data: {
          billingHistory,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          },
          summary: {
            totalBills: summary._count.id || 0,
            totalAmount: summary._sum.amount || 0,
            paidAmount: paidAmount._sum.amount || 0,
            pendingAmount: (summary._sum.amount || 0) - (paidAmount._sum.amount || 0)
          }
        }
      });

    } catch (error) {
      console.error('Error in billing history endpoint:', error);
      
      // Handle specific database connection errors
      if (error.code === 'P1001') {
        return res.status(503).json({
          error: 'Database temporarily unavailable',
          message: 'Please try again in a few moments',
          code: 'DATABASE_UNAVAILABLE'
        });
      }
      
      // Handle other Prisma errors
      if (error.code && error.code.startsWith('P')) {
        return res.status(500).json({
          error: 'Database operation failed',
          message: 'Please try again later',
          code: 'DATABASE_ERROR'
        });
      }
      
      next(error);
    }
  }
);

// Helper function to invalidate cache when billing data changes
const invalidateBillingCache = async (customerId) => {
  try {
    // Clear sync cache for this customer
    billingService.clearSyncCache(customerId);
    console.log('🗑️ Invalidated billing cache for customer:', customerId);
  } catch (error) {
    console.error('Error invalidating billing cache:', error);
  }
};

// Get specific billing record with receipts
router.get('/history/:id',
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const billingRecord = await prisma.billingHistory.findFirst({
        where: {
          id,
          customerId: req.user.id
        },
        include: {
          receipts: {
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!billingRecord) {
        return res.status(404).json({
          error: 'Billing record not found',
          code: 'BILLING_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: billingRecord
      });

    } catch (error) {
      next(error);
    }
  }
);

// Download receipt
router.get('/receipts/:id/download',
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const receipt = await prisma.receipt.findFirst({
        where: {
          id,
          customerId: req.user.id
        }
      });

      if (!receipt) {
        return res.status(404).json({
          error: 'Receipt not found',
          code: 'RECEIPT_NOT_FOUND'
        });
      }

      // Update download status
      await prisma.receipt.update({
        where: { id },
        data: {
          isDownloaded: true,
          downloadedAt: new Date()
        }
      });

      res.json({
        success: true,
        data: {
          downloadUrl: receipt.fileUrl,
          fileName: receipt.fileName,
          fileSize: receipt.fileSize,
          mimeType: receipt.mimeType
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get receipts for a specific billing record
router.get('/history/:id/receipts',
  verifyToken,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Verify billing record belongs to customer
      const billingRecord = await prisma.billingHistory.findFirst({
        where: {
          id,
          customerId: req.user.id
        }
      });

      if (!billingRecord) {
        return res.status(404).json({
          error: 'Billing record not found',
          code: 'BILLING_NOT_FOUND'
        });
      }

      const receipts = await prisma.receipt.findMany({
        where: {
          billingHistoryId: id,
          customerId: req.user.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        data: receipts
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get all receipts for customer
router.get('/receipts',
  verifyToken,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
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

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const receipts = await prisma.receipt.findMany({
        where: {
          customerId: req.user.id
        },
        include: {
          billingHistory: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              description: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      });

      // Get total count for pagination
      const totalCount = await prisma.receipt.count({
        where: {
          customerId: req.user.id
        }
      });

      res.json({
        success: true,
        data: {
          receipts,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          }
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