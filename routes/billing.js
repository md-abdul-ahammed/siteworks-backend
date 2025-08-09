const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { 
  verifyToken, 
  rateLimiter, 
  errorHandler 
} = require('../middleware/auth');
const BillingIntegrationService = require('../services/billingIntegration');
const ZohoService = require('../services/zoho');

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
const zohoService = new ZohoService();

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

// Get invoices for customer from Zoho
router.get('/invoices',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('status').optional().isString(),
    query('source').optional().isIn(['db', 'zoho'])
  ],
  async (req, res, next) => {
    try {
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
      const source = req.query.source || 'zoho';

      console.log('🔍 Customer invoices request:', { 
        userId: req.user.id, 
        page, 
        limit, 
        status, 
        source 
      });

      if (source === 'zoho') {
        // Get customer info from database
        const customer = await executeWithRetry(async () => {
          return await prisma.customer.findUnique({
            where: { id: req.user.id },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
              zohoCustomerId: true
            }
          });
        });

        if (!customer) {
          return res.status(404).json({
            error: 'Customer not found',
            code: 'CUSTOMER_NOT_FOUND'
          });
        }

        if (!customer.zohoCustomerId) {
          return res.json({
            success: true,
            invoices: [],
            stats: {
              totalInvoices: 0,
              totalAmount: 0,
              paidInvoices: 0,
              pendingInvoices: 0,
              overdueInvoices: 0
            },
            message: 'No Zoho customer ID found'
          });
        }

        try {
          console.log(`🔍 Fetching invoices for customer: ${customer.email} (Zoho ID: ${customer.zohoCustomerId})`);
          
          // Fetch invoices from Zoho for this specific customer
          const customerInvoices = await zohoService.getCustomerInvoices(customer.zohoCustomerId);
          
          console.log(`📄 Found ${customerInvoices.length} invoices for customer`);

          // Filter invoices based on status if provided
          let filteredInvoices = customerInvoices;
          if (status && status !== 'all') {
            filteredInvoices = customerInvoices.filter(invoice => 
              invoice.status?.toLowerCase() === status.toLowerCase()
            );
          }

          // Transform invoices to match expected format
          const transformedInvoices = filteredInvoices.map(invoice => ({
            id: invoice.invoice_id,
            invoiceNumber: invoice.invoice_number,
            customerName: `${customer.firstName} ${customer.lastName}`.trim() || customer.companyName || 'Unknown',
            customerEmail: customer.email,
            amount: parseFloat(invoice.total) || 0,
            status: invoice.status || 'unknown',
            dueDate: invoice.due_date,
            createdDate: invoice.date || invoice.created_time,
            pdfUrl: invoice.pdf_url
          }));

          // Sort by created date (newest first)
          transformedInvoices.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

          // Apply pagination
          const skip = (page - 1) * limit;
          const paginatedInvoices = transformedInvoices.slice(skip, skip + limit);

          // Calculate statistics
          const totalAmount = transformedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
          const paidInvoices = transformedInvoices.filter(inv => inv.status === 'paid' || inv.status === 'partially_paid').length;
          const pendingInvoices = transformedInvoices.filter(inv => 
            inv.status === 'pending' || 
            inv.status === 'sent' || 
            inv.status === 'approved' || 
            inv.status === 'pending_approval'
          ).length;
          const overdueInvoices = transformedInvoices.filter(inv => inv.status === 'overdue').length;

          const stats = {
            totalInvoices: transformedInvoices.length,
            totalAmount,
            paidInvoices,
            pendingInvoices,
            overdueInvoices
          };

          res.json({
            success: true,
            invoices: paginatedInvoices,
            stats,
            pagination: {
              page,
              limit,
              total: transformedInvoices.length,
              pages: Math.ceil(transformedInvoices.length / limit)
            },
            source: 'zoho'
          });

        } catch (error) {
          console.error(`❌ Error fetching invoices for customer ${customer.email}:`, error);
          
          // If Zoho fails, return empty result rather than error
          return res.json({
            success: true,
            invoices: [],
            stats: {
              totalInvoices: 0,
              totalAmount: 0,
              paidInvoices: 0,
              pendingInvoices: 0,
              overdueInvoices: 0
            },
            error: 'Failed to fetch invoices from Zoho',
            source: 'zoho'
          });
        }
      } else {
        // Fallback to database billing history
        const whereClause = { customerId: req.user.id };
        if (status && status !== 'all') {
          whereClause.status = status;
        }

        const offset = (page - 1) * limit;

        const billingHistory = await executeWithRetry(async () => {
          return await prisma.billingHistory.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: {
              receipts: {
                select: {
                  id: true,
                  receiptNumber: true,
                  amount: true,
                  status: true,
                  createdAt: true
                }
              }
            }
          });
        });

        const totalCount = await executeWithRetry(async () => {
          return await prisma.billingHistory.count({
            where: whereClause
          });
        });

        // Transform billing history to invoice format
        const transformedInvoices = billingHistory.map(record => ({
          id: record.id,
          invoiceNumber: record.transactionId || record.id,
          customerName: 'You',
          customerEmail: req.user.email,
          amount: parseFloat(record.amount) || 0,
          status: record.status,
          dueDate: record.dueDate,
          createdDate: record.createdAt,
          pdfUrl: null
        }));

        // Calculate stats
        const allRecords = await executeWithRetry(async () => {
          return await prisma.billingHistory.findMany({
            where: { customerId: req.user.id }
          });
        });

        const totalAmount = allRecords.reduce((sum, record) => sum + (parseFloat(record.amount) || 0), 0);
        const paidInvoices = allRecords.filter(record => record.status === 'paid').length;
        const pendingInvoices = allRecords.filter(record => record.status === 'pending').length;
        const overdueInvoices = allRecords.filter(record => record.status === 'failed').length;

        const stats = {
          totalInvoices: allRecords.length,
          totalAmount,
          paidInvoices,
          pendingInvoices,
          overdueInvoices
        };

        res.json({
          success: true,
          invoices: transformedInvoices,
          stats,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          },
          source: 'db'
        });
      }

    } catch (error) {
      console.error('❌ Customer invoices endpoint error:', error);
      next(error);
    }
  }
);

// Get invoice PDF for customer
router.get('/invoices/:invoiceId/pdf',
  verifyToken,
  async (req, res, next) => {
    try {
      const { invoiceId } = req.params;
      console.log('🔍 PDF request for invoice:', invoiceId, 'by user:', req.user.id);

      // Get customer info from database to verify they own this invoice
      const customer = await executeWithRetry(async () => {
        return await prisma.customer.findUnique({
          where: { id: req.user.id },
          select: {
            id: true,
            email: true,
            zohoCustomerId: true
          }
        });
      });

      if (!customer) {
        return res.status(404).json({
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      if (!customer.zohoCustomerId) {
        return res.status(400).json({
          error: 'No Zoho customer ID found',
          code: 'NO_ZOHO_CUSTOMER_ID'
        });
      }

      try {
        // Verify the invoice belongs to this customer
        const customerInvoices = await zohoService.getCustomerInvoices(customer.zohoCustomerId);
        const invoice = customerInvoices.find(inv => inv.invoice_id === invoiceId);

        if (!invoice) {
          return res.status(403).json({
            error: 'Invoice not found or access denied',
            code: 'INVOICE_ACCESS_DENIED'
          });
        }

        // Stream PDF if requested
        if (req.query.stream === 'true') {
          try {
            console.log('📄 Attempting binary PDF fetch...');
            const data = await zohoService.fetchInvoicePDFBinary(invoiceId);
            console.log('✅ Binary PDF fetched, size:', data.byteLength);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', req.query.disposition === 'attachment' ? `attachment; filename="invoice-${invoiceId}.pdf"` : `inline; filename="invoice-${invoiceId}.pdf"`);
            return res.send(Buffer.from(data));
          } catch (e) {
            console.log('❌ Binary fetch failed:', e.message);
            // If binary fetch fails, fall back to returning download URL
            const downloadUrl = await zohoService.getInvoicePDF(invoiceId);
            console.log('📄 Falling back to download URL:', downloadUrl);
            return res.json({ success: true, data: { downloadUrl } });
          }
        }
        
        // Default: return download URL
        const downloadUrl = await zohoService.getInvoicePDF(invoiceId);
        return res.json({ success: true, data: { downloadUrl } });

      } catch (error) {
        console.error(`❌ Error accessing invoice ${invoiceId} for customer ${customer.email}:`, error);
        return res.status(500).json({
          error: 'Failed to access invoice',
          message: error.message
        });
      }

    } catch (error) {
      console.error('❌ Customer invoice PDF endpoint error:', error);
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

module.exports = router; 