const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { 
  verifyToken, 
  rateLimiter, 
  errorHandler 
} = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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

      // Get billing history with receipts count
      const billingHistory = await prisma.billingHistory.findMany({
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

      // Get total count for pagination
      const totalCount = await prisma.billingHistory.count({
        where: whereClause
      });

      // Calculate summary statistics
      const summary = await prisma.billingHistory.aggregate({
        where: whereClause,
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      const paidAmount = await prisma.billingHistory.aggregate({
        where: {
          ...whereClause,
          status: 'paid'
        },
        _sum: {
          amount: true
        }
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
      next(error);
    }
  }
);

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