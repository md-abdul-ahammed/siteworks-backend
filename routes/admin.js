const express = require('express');
const { body, validationResult, query } = require('express-validator');
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
  updateLastLogin
} = require('../utils/auth');

const router = express.Router();
const prisma = new PrismaClient();
const ZohoService = require('../services/zoho');
const zohoService = new ZohoService();
const GoCardlessService = require('../services/gocardless');
const goCardlessService = new GoCardlessService();
const OpenPhoneSyncService = require('../services/openphone-sync');
const openPhoneSyncService = new OpenPhoneSyncService();
const OpenPhoneMessageService = require('../services/openphone-messages');
const openPhoneMessageService = new OpenPhoneMessageService();

// Small retry helper for DB calls (helps with PgBouncer cold starts)
async function withDbRetry(action, { retries = 2, backoffMs = 300 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError;
}

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const customer = await withDbRetry(() => prisma.customer.findUnique({
      where: { id: req.user.id },
      include: { adminData: true }
    }));

    if (!customer || customer.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }

    req.admin = customer;
    next();
  } catch (error) {
    next(error);
  }
};

// Get admin dashboard overview
router.get('/dashboard',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { source = 'db' } = req.query;

      if (source === 'zoho') {
        // Fetch all customers from Zoho for UI testing
        console.log('🔄 Fetching ALL Zoho customers for dashboard...');
        let allCustomers = [];
        let currentPage = 1;
        let hasMore = true;
        
        while (hasMore) {
          try {
            console.log(`📄 Fetching customers page ${currentPage}...`);
            const options = { page: currentPage, per_page: 200 }; // Max per page
            const zohoResp = await zohoService.getAllCustomers(options);
            const pageCustomers = Array.isArray(zohoResp.contacts) ? zohoResp.contacts : [];
            
            if (pageCustomers.length === 0) {
              hasMore = false;
            } else {
              allCustomers.push(...pageCustomers);
              currentPage++;
              
              // Check if we've reached the end
              const totalFromZoho = Number(zohoResp.page_context?.total || 0);
              if (allCustomers.length >= totalFromZoho) {
                hasMore = false;
              }
            }
          } catch (error) {
            console.error(`❌ Error fetching customers page ${currentPage}:`, error);
            hasMore = false;
          }
        }
        
        console.log(`✅ Fetched ${allCustomers.length} total customers from Zoho`);

        // Transform Zoho customers to match our interface
        const recentUsers = allCustomers.slice(0, 10).map(customer => ({
          id: customer.contact_id,
          email: customer.email || '',
          firstName: customer.first_name || '',
          lastName: customer.last_name || '',
          companyName: customer.company_name || '',
          isActive: true, // Assume active for Zoho customers
          isVerified: true, // Assume verified for Zoho customers
          createdAt: customer.created_time || new Date().toISOString(),
          lastLoginAt: null,
          goCardlessCustomerId: null,
          mandateStatus: null
        }));

        // Calculate stats from Zoho data
        const totalUsers = allCustomers.length;
        const activeUsers = allCustomers.filter(c => c.status !== 'inactive').length;
        const verifiedUsers = allCustomers.filter(c => c.email).length; // Customers with email considered verified
        const usersWithGoCardless = 0; // Zoho doesn't have this info
        const recentRegistrations = allCustomers.filter(c => {
          const createdDate = new Date(c.created_time || 0);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return createdDate >= thirtyDaysAgo;
        }).length;

        // Get billing statistics from Zoho invoices
        let totalRevenue = 0;
        let totalTransactions = 0;
        try {
          console.log('📊 Fetching billing stats from Zoho...');
          const invoiceOptions = { page: 1, per_page: 200 };
          const invoiceResp = await zohoService.getAllInvoices(invoiceOptions);
          const invoices = Array.isArray(invoiceResp.invoices) ? invoiceResp.invoices : [];
          
          totalRevenue = invoices
            .filter(inv => inv.status === 'paid')
            .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
          totalTransactions = invoices.filter(inv => inv.status === 'paid').length;
        } catch (error) {
          console.error('❌ Error fetching billing stats:', error);
        }

        return res.json({
          success: true,
          dashboard: {
            overview: {
              totalUsers,
              activeUsers,
              verifiedUsers,
              usersWithGoCardless,
              recentRegistrations,
              totalRevenue,
              totalTransactions
            },
            recentUsers
          },
          source: 'zoho'
        });
      }

      // Default: Get data from database
      // Get total users count
      const totalUsers = await withDbRetry(() => prisma.customer.count({
        where: { role: 'user' }
      }));

      // Get active users count
      const activeUsers = await withDbRetry(() => prisma.customer.count({
        where: { 
          role: 'user',
          isActive: true 
        }
      }));

      // Get verified users count
      const verifiedUsers = await withDbRetry(() => prisma.customer.count({
        where: { 
          role: 'user',
          isVerified: true 
        }
      }));

      // Get users with GoCardless integration
      const usersWithGoCardless = await withDbRetry(() => prisma.customer.count({
        where: { 
          role: 'user',
          goCardlessCustomerId: { not: null }
        }
      }));

      // Get recent registrations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentRegistrations = await withDbRetry(() => prisma.customer.count({
        where: { 
          role: 'user',
          createdAt: { gte: thirtyDaysAgo }
        }
      }));

      // Get billing statistics
      const billingStats = await withDbRetry(() => prisma.billingHistory.aggregate({
        _sum: {
          amount: true
        },
        _count: {
          id: true
        },
        where: {
          status: 'paid'
        }
      }));

      // Get recent users
      const recentUsers = await withDbRetry(() => prisma.customer.findMany({
        where: { role: 'user' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          goCardlessCustomerId: true,
          mandateStatus: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }));

      res.json({
        success: true,
        dashboard: {
          overview: {
            totalUsers,
            activeUsers,
            verifiedUsers,
            usersWithGoCardless,
            recentRegistrations,
            totalRevenue: billingStats._sum.amount || 0,
            totalTransactions: billingStats._count.id || 0
          },
          recentUsers
        },
        source: 'db'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get Zoho invoice PDF download URL
router.get('/zoho/invoices/:invoiceId/pdf',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { invoiceId } = req.params;
      console.log('🔍 PDF request for invoice:', invoiceId);
      
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
      console.error('❌ PDF endpoint error:', error);
      next(error);
    }
  }
);

// Get all Zoho invoices for admin (OLD METHOD - DISABLED)
/*
router.get('/zoho/invoices',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        search = '', 
        status = '' 
      } = req.query;

      console.log('🔍 Admin Zoho invoices request:', { page, limit, search, status });

      // Get all customers from database to fetch their invoices
      const customers = await withDbRetry(() => prisma.customer.findMany({
        where: { role: 'user' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          zohoCustomerId: true
        }
      }));

      console.log(`📊 Found ${customers.length} customers in database`);

      let allInvoices = [];
      let totalAmount = 0;
      let paidInvoices = 0;
      let pendingInvoices = 0;
      let overdueInvoices = 0;

      // Fetch invoices for each customer from Zoho
      for (const customer of customers) {
        if (customer.zohoCustomerId) {
          try {
            console.log(`🔍 Fetching invoices for customer: ${customer.email}`);
            const customerInvoices = await zohoService.getCustomerInvoices(customer.zohoCustomerId);
            
            // Filter invoices based on search and status
            let filteredInvoices = customerInvoices;
            
            if (search) {
              filteredInvoices = customerInvoices.filter(invoice => 
                invoice.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
                customer.firstName?.toLowerCase().includes(search.toLowerCase()) ||
                customer.lastName?.toLowerCase().includes(search.toLowerCase()) ||
                customer.email?.toLowerCase().includes(search.toLowerCase())
              );
            }

            if (status && status !== 'all') {
              filteredInvoices = filteredInvoices.filter(invoice => 
                invoice.status?.toLowerCase() === status.toLowerCase()
              );
            }

            // Transform invoices to include customer info
            const transformedInvoices = filteredInvoices.map(invoice => ({
              id: invoice.invoice_id,
              invoiceNumber: invoice.invoice_number,
              customerName: `${customer.firstName} ${customer.lastName}`.trim(),
              customerEmail: customer.email,
              amount: parseFloat(invoice.total) || 0,
              status: invoice.status || 'unknown',
              dueDate: invoice.due_date,
              createdDate: invoice.date,
              pdfUrl: invoice.pdf_url
            }));

            allInvoices.push(...transformedInvoices);

            // Calculate statistics
            transformedInvoices.forEach(invoice => {
              totalAmount += invoice.amount;
              switch (invoice.status.toLowerCase()) {
                case 'paid':
                  paidInvoices++;
                  break;
                case 'pending':
                case 'sent':
                  pendingInvoices++;
                  break;
                case 'overdue':
                  overdueInvoices++;
                  break;
              }
            });

          } catch (error) {
            console.error(`❌ Error fetching invoices for customer ${customer.email}:`, error);
          }
        }
      }

      // Sort invoices by created date (newest first)
      allInvoices.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

      // Apply pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const paginatedInvoices = allInvoices.slice(skip, skip + parseInt(limit));

      const stats = {
        totalInvoices: allInvoices.length,
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
          page: parseInt(page),
          limit: parseInt(limit),
          total: allInvoices.length,
          pages: Math.ceil(allInvoices.length / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('❌ Admin Zoho invoices endpoint error:', error);
      next(error);
    }
  }
);
*/

// Get all users with pagination and filters
router.get('/users',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search = '', 
        startDate = '', 
        endDate = ''
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Build where clause
      const where = {
        role: 'user'
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { companyName: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Date range filtering
      if (startDate || endDate) {
        where.createdAt = {};
        
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        
        if (endDate) {
          // Set end date to end of day
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          where.createdAt.lte = endDateTime;
        }
      }

      // Get total count
      const totalUsers = await withDbRetry(() => prisma.customer.count({ where }));

      // Get users
      const users = await withDbRetry(() => prisma.customer.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          phone: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          goCardlessCustomerId: true,
          goCardlessBankAccountId: true,
          goCardlessMandateId: true,
          mandateStatus: true,
          openPhoneContactId: true,
          countryOfResidence: true,
          city: true,
          addressLine1: true,
          addressLine2: true,
          state: true,
          postcode: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }));

      res.json({
        success: true,
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          pages: Math.ceil(totalUsers / parseInt(limit))
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get user details
router.get('/users/:userId',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await withDbRetry(() => prisma.customer.findUnique({
        where: { 
          id: userId,
          role: 'user'
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          phone: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          countryOfResidence: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postcode: true,
          state: true,
          goCardlessCustomerId: true,
          goCardlessBankAccountId: true,
          goCardlessMandateId: true,
          mandateStatus: true,
          openPhoneContactId: true,
          billingHistory: {
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              description: true,
              dueDate: true,
              paidAt: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      }));

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        user
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update user status (activate/deactivate)
router.patch('/users/:userId/status',
  verifyToken,
  requireAdmin,
  [
    body('isActive')
      .isBoolean()
      .withMessage('isActive must be a boolean')
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

      const { userId } = req.params;
      const { isActive } = req.body;

      const user = await withDbRetry(() => prisma.customer.findUnique({
        where: { 
          id: userId,
          role: 'user'
        }
      }));

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const updatedUser = await withDbRetry(() => prisma.customer.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          updatedAt: true
        }
      }));

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: updatedUser
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update user verification status
router.patch('/users/:userId/verification',
  verifyToken,
  requireAdmin,
  [
    body('isVerified')
      .isBoolean()
      .withMessage('isVerified must be a boolean')
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

      const { userId } = req.params;
      const { isVerified } = req.body;

      const user = await withDbRetry(() => prisma.customer.findUnique({
        where: { 
          id: userId,
          role: 'user'
        }
      }));

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const updatedUser = await withDbRetry(() => prisma.customer.update({
        where: { id: userId },
        data: { isVerified },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          updatedAt: true
        }
      }));

      res.json({
        success: true,
        message: `User ${isVerified ? 'verified' : 'unverified'} successfully`,
        user: updatedUser
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update user profile (admin can edit all user data)
router.put('/users/:userId/profile',
  verifyToken,
  requireAdmin,
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('companyName').optional().trim(),
    body('phone').optional().trim(),
    body('countryOfResidence').optional().trim(),
    body('addressLine1').optional().trim(),
    body('addressLine2').optional().trim(),
    body('city').optional().trim(),
    body('postcode').optional().trim(),
    body('state').optional().trim(),
    body('goCardlessCustomerId').optional().trim(),
    body('goCardlessBankAccountId').optional().trim(),
    body('goCardlessMandateId').optional().trim(),
    body('mandateStatus').optional().trim(),
    body('openPhoneContactId').optional().trim()
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

      const { userId } = req.params;
      const updateData = req.body;

      const user = await withDbRetry(() => prisma.customer.findUnique({
        where: { 
          id: userId,
          role: 'user'
        }
      }));

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Get current user data to check if we need to update external services
      const currentUser = await withDbRetry(() => prisma.customer.findUnique({
        where: { id: userId }
      }));

      const updatedUser = await withDbRetry(() => prisma.customer.update({
        where: { id: userId },
        data: updateData,
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
          goCardlessCustomerId: true,
          goCardlessBankAccountId: true,
          goCardlessMandateId: true,
          mandateStatus: true,
          openPhoneContactId: true,
          isActive: true,
          isVerified: true,
          updatedAt: true
        }
      }));

      // Update GoCardless customer if they have a GoCardless customer ID
      let gocardlessUpdated = false;
      if (currentUser.goCardlessCustomerId) {
        try {
          console.log('Updating GoCardless customer:', currentUser.goCardlessCustomerId);
          
          // Prepare customer data for GoCardless update
          const goCardlessCustomerData = {
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            companyName: updatedUser.companyName,
            phone: updatedUser.phone,
            countryOfResidence: updatedUser.countryOfResidence,
            address: {
              line1: updatedUser.addressLine1,
              line2: updatedUser.addressLine2,
              city: updatedUser.city,
              postcode: updatedUser.postcode,
              state: updatedUser.state
            }
          };

          await goCardlessService.updateCustomer(currentUser.goCardlessCustomerId, goCardlessCustomerData);
          console.log('GoCardless customer updated successfully');
          gocardlessUpdated = true;
        } catch (goCardlessError) {
          console.error('Failed to update GoCardless customer:', goCardlessError);
          // Don't fail the entire request if GoCardless update fails
          // The database update was successful, so we'll return success but log the GoCardless error
        }
      }

      // Check if phone number changed
      const phoneChanged = currentUser.phone !== updatedUser.phone;
      const oldPhone = currentUser.phone;
      const newPhone = updatedUser.phone;

      // Sync with OpenPhone
      let openPhoneSynced = false;
      try {
        console.log('Syncing profile update with OpenPhone for customer:', userId);
        
        // Prepare customer data for OpenPhone sync
        const openPhoneCustomerData = {
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          companyName: updatedUser.companyName,
          phone: updatedUser.phone,
          openPhoneContactId: updatedUser.openPhoneContactId,
          addressLine1: updatedUser.addressLine1,
          addressLine2: updatedUser.addressLine2,
          city: updatedUser.city,
          postcode: updatedUser.postcode,
          state: updatedUser.state
        };

        console.log('OpenPhone customer data:', openPhoneCustomerData);
        console.log('User openPhoneContactId:', updatedUser.openPhoneContactId);

        const openPhoneResult = await openPhoneSyncService.syncProfileUpdate(userId, openPhoneCustomerData);
        console.log('OpenPhone sync result:', openPhoneResult ? 'Success' : 'Failed');
        openPhoneSynced = !!openPhoneResult;
      } catch (openPhoneError) {
        console.error('Failed to sync with OpenPhone:', openPhoneError);
        // Don't fail the entire request if OpenPhone sync fails
        // The database update was successful, so we'll return success but log the OpenPhone error
      }

      // Send phone update message if phone number changed
      let phoneUpdateMessageSent = false;
      if (phoneChanged && newPhone) {
        try {
          console.log('Phone number changed, sending update message to:', newPhone);
          
          const messageResult = await openPhoneMessageService.sendPhoneUpdateMessage(
            updatedUser,
            oldPhone,
            newPhone
          );
          
          phoneUpdateMessageSent = !!messageResult;
          console.log('Phone update message result:', phoneUpdateMessageSent ? 'Sent' : 'Failed');
        } catch (messageError) {
          console.error('Failed to send phone update message:', messageError);
          // Don't fail the entire request if message sending fails
        }
      }

      res.json({
        success: true,
        message: 'User profile updated successfully',
        user: updatedUser,
        gocardlessUpdated: gocardlessUpdated,
        openPhoneSynced: openPhoneSynced,
        phoneChanged: phoneChanged,
        phoneUpdateMessageSent: phoneUpdateMessageSent
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get billing analytics
router.get('/analytics/billing',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { period = '30' } = req.query; // days
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      // Get billing statistics
      const billingStats = await withDbRetry(() => prisma.billingHistory.aggregate({
        _sum: {
          amount: true
        },
        _count: {
          id: true
        },
        where: {
          createdAt: { gte: daysAgo }
        }
      }));

      // Get status breakdown
      const statusBreakdown = await withDbRetry(() => prisma.billingHistory.groupBy({
        by: ['status'],
        _count: {
          id: true
        },
        _sum: {
          amount: true
        },
        where: {
          createdAt: { gte: daysAgo }
        }
      }));

      // Get monthly revenue for the last 12 months
      const monthlyRevenue = await withDbRetry(() => prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          SUM(amount) as total_revenue,
          COUNT(*) as transaction_count
        FROM billing_history 
        WHERE "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
      `);

      res.json({
        success: true,
        analytics: {
          period: parseInt(period),
          totalRevenue: billingStats._sum.amount || 0,
          totalTransactions: billingStats._count.id || 0,
          statusBreakdown,
          monthlyRevenue
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// List Zoho invoices directly from Zoho (not only DB)
router.get('/zoho/invoices',
  verifyToken,
  requireAdmin,
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
        return res.status(400).json({ error: 'Validation failed', details: errors.array(), code: 'VALIDATION_ERROR' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;
      const source = req.query.source || 'db';

      if (source === 'zoho') {
        // Fetch ALL invoices from Zoho without pagination
        console.log('🔄 Fetching ALL Zoho invoices...');
        let allInvoices = [];
        let currentPage = 1;
        let hasMore = true;
        
        while (hasMore) {
          try {
            console.log(`📄 Fetching page ${currentPage}...`);
            const options = { page: currentPage, per_page: 200 }; // Max per page
            const zohoResp = await zohoService.getAllInvoices(options);
            const pageInvoices = Array.isArray(zohoResp.invoices) ? zohoResp.invoices : [];
            
            if (pageInvoices.length === 0) {
              hasMore = false;
            } else {
              allInvoices.push(...pageInvoices);
              currentPage++;
              
              // Check if we've reached the end
              const totalFromZoho = Number(zohoResp.page_context?.total || 0);
              if (allInvoices.length >= totalFromZoho) {
                hasMore = false;
              }
            }
          } catch (error) {
            console.error(`❌ Error fetching page ${currentPage}:`, error);
            hasMore = false;
          }
        }
        
        console.log(`✅ Fetched ${allInvoices.length} total invoices from Zoho`);
        const total = allInvoices.length;

        const mapped = allInvoices.map((inv) => ({
          id: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          customerName: inv.customer_name || 'Unknown Customer',
          customerEmail: inv.customer_email || '',
          amount: Number(inv.total) || 0,
          status: inv.status || 'pending',
          dueDate: inv.due_date,
          createdDate: inv.date || inv.created_time,
          pdfUrl: inv.pdf_url || null
        }));

        const totalAmount = mapped.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const paidAmount = mapped.filter(r => r.status === 'paid').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

        return res.json({
          success: true,
          invoices: mapped, // All invoices, no pagination
          stats: {
            totalInvoices: total,
            totalAmount,
            paidInvoices: mapped.filter(r => r.status === 'paid' || r.status === 'partially_paid').length,
            pendingInvoices: mapped.filter(r => 
              r.status === 'pending' || 
              r.status === 'sent' || 
              r.status === 'approved' || 
              r.status === 'pending_approval'
            ).length,
            overdueInvoices: mapped.filter(r => r.status === 'overdue').length
          },
          allDataFetched: true // Flag to indicate all data is returned
        });
      }

      // Fallback to DB (existing behavior)
      const offset = (page - 1) * limit;
      const whereClause = { zohoInvoiceId: { not: null }, ...(status ? { status } : {}) };
      const invoices = await withDbRetry(() => prisma.billingHistory.findMany({
        where: whereClause,
        include: {
          receipts: { select: { id: true, fileName: true, fileUrl: true, isDownloaded: true, createdAt: true } },
          _count: { select: { receipts: true } },
          customer: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }));
      const totalCount = await withDbRetry(() => prisma.billingHistory.count({ where: whereClause }));
      const summaryAgg = await withDbRetry(() => prisma.billingHistory.aggregate({ where: whereClause, _sum: { amount: true }, _count: { id: true } }));
      const paidAgg = await withDbRetry(() => prisma.billingHistory.aggregate({ where: { ...whereClause, status: 'paid' }, _sum: { amount: true } }));

      const billingHistory = invoices.map(inv => ({
        ...inv,
        customerName: inv.customer?.companyName || `${inv.customer?.firstName || ''} ${inv.customer?.lastName || ''}`.trim(),
        customerId: inv.customer?.id,
      }));

      res.json({
        success: true,
        data: {
          billingHistory,
          pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
          summary: {
            totalBills: summaryAgg._count.id || 0,
            totalAmount: summaryAgg._sum.amount || 0,
            paidAmount: paidAgg._sum.amount || 0,
            pendingAmount: (summaryAgg._sum.amount || 0) - (paidAgg._sum.amount || 0)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Test endpoint to debug Zoho API responses
router.get('/zoho/test',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { invoiceId } = req.query;
      if (!invoiceId) {
        return res.status(400).json({ error: 'invoiceId query parameter required' });
      }

      console.log('🔍 Testing Zoho API for invoice:', invoiceId);

      // Test 1: Get invoice details
      let invoiceDetails;
      try {
        invoiceDetails = await zohoService.getInvoice(invoiceId);
        console.log('✅ Invoice details:', JSON.stringify(invoiceDetails, null, 2));
      } catch (e) {
        console.log('❌ Failed to get invoice details:', e.message);
        invoiceDetails = null;
      }

      // Test 2: Get PDF URL
      let pdfUrl;
      try {
        pdfUrl = await zohoService.getInvoicePDF(invoiceId);
        console.log('✅ PDF URL:', pdfUrl);
      } catch (e) {
        console.log('❌ Failed to get PDF URL:', e.message);
        pdfUrl = null;
      }

      // Test 3: Try binary fetch
      let binaryResult;
      try {
        const binary = await zohoService.fetchInvoicePDFBinary(invoiceId);
        binaryResult = { success: true, size: binary.byteLength };
        console.log('✅ Binary fetch success, size:', binary.byteLength);
      } catch (e) {
        console.log('❌ Binary fetch failed:', e.message);
        binaryResult = { success: false, error: e.message };
      }

      // Test 4: Check if invoice exists in our DB
      const dbInvoice = await withDbRetry(() => prisma.billingHistory.findFirst({
        where: { zohoInvoiceId: invoiceId }
      }));

      res.json({
        success: true,
        data: {
          invoiceId,
          invoiceDetails,
          pdfUrl,
          binaryResult,
          inDatabase: !!dbInvoice,
          dbRecord: dbInvoice ? {
            id: dbInvoice.id,
            status: dbInvoice.status,
            amount: dbInvoice.amount,
            customerId: dbInvoice.customerId
          } : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user analytics
router.get('/analytics/users',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { period = '30' } = req.query; // days
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      // Get user registration stats
      const userStats = await withDbRetry(() => prisma.customer.aggregate({
        _count: {
          id: true
        },
        where: {
          role: 'user',
          createdAt: { gte: daysAgo }
        }
      }));

      // Get user status breakdown
      const statusBreakdown = await withDbRetry(() => prisma.customer.groupBy({
        by: ['isActive', 'isVerified'],
        _count: {
          id: true
        },
        where: {
          role: 'user'
        }
      }));

      // Get GoCardless integration stats
      const goCardlessStats = await withDbRetry(() => prisma.customer.groupBy({
        by: ['mandateStatus'],
        _count: {
          id: true
        },
        where: {
          role: 'user',
          goCardlessCustomerId: { not: null }
        }
      }));

      // Get monthly registrations for the last 12 months
      const monthlyRegistrations = await withDbRetry(() => prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as new_users
        FROM customers 
        WHERE role = 'user' AND "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
      `);

      res.json({
        success: true,
        analytics: {
          period: parseInt(period),
          newUsers: userStats._count.id || 0,
          statusBreakdown,
          goCardlessStats,
          monthlyRegistrations
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Create admin user (only for the first admin)
router.post('/create-admin',
  verifyToken,
  requireAdmin,
  [
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
    body('permissions')
      .isArray()
      .withMessage('Permissions must be an array')
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

      const { email, password, firstName, lastName, permissions } = req.body;

      // Check if admin already exists
      const existingAdmin = await withDbRetry(() => prisma.customer.findFirst({
        where: { role: 'admin' }
      }));

      if (existingAdmin) {
        return res.status(400).json({
          error: 'Admin already exists. Only one admin is allowed.',
          code: 'ADMIN_EXISTS'
        });
      }

      // Check if email already exists
      const existingCustomer = await withDbRetry(() => prisma.customer.findUnique({
        where: { email }
      }));

      if (existingCustomer) {
        return res.status(409).json({
          error: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create admin user
      const admin = await withDbRetry(() => prisma.customer.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'admin',
          isVerified: true,
          isActive: true,
          countryOfResidence: 'GB', // Default values for admin
          addressLine1: 'Admin Address',
          city: 'Admin City',
          postcode: '00000'
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true
        }
      }));

      // Create admin data
      await withDbRetry(() => prisma.admin.create({
        data: {
          customerId: admin.id,
          permissions: permissions || ['manage_users', 'view_analytics', 'manage_billing']
        }
      }));

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        admin
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get admin profile
router.get('/profile',
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const admin = await withDbRetry(() => prisma.customer.findUnique({
        where: { id: req.user.id },
        include: { adminData: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          adminData: {
            select: {
              permissions: true,
              lastAdminAction: true,
              createdAt: true
            }
          }
        }
      }));

      res.json({
        success: true,
        admin
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update admin permissions
router.patch('/permissions',
  verifyToken,
  requireAdmin,
  [
    body('permissions')
      .isArray()
      .withMessage('Permissions must be an array')
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

      const { permissions } = req.body;

      const updatedAdmin = await withDbRetry(() => prisma.admin.update({
        where: { customerId: req.user.id },
        data: { 
          permissions,
          lastAdminAction: new Date()
        },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      }));

      res.json({
        success: true,
        message: 'Permissions updated successfully',
        admin: updatedAdmin
      });

    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

module.exports = router; 