const { PrismaClient } = require('@prisma/client');
const GoCardlessService = require('./gocardless');
const ZohoService = require('./zoho');

class BillingIntegrationService {
  constructor() {
    this.prisma = new PrismaClient();
    this.goCardlessService = new GoCardlessService();
    this.zohoService = new ZohoService();
    
    // Add cache for sync operations
    this.syncCache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Create a complete billing cycle: Zoho Invoice → GoCardless Payment → Database Records
   * @param {Object} billingData - Billing information
   * @param {string} billingData.customerId - Internal customer ID
   * @param {number} billingData.amount - Amount in pence/cents
   * @param {string} billingData.currency - Currency code
   * @param {string} billingData.description - Billing description
   * @param {Date} billingData.dueDate - Due date
   * @param {Object} billingData.customer - Customer information for Zoho
   * @param {Object} billingData.items - Invoice items
   * @returns {Promise<Object>} Created billing records
   */
  async createBillingCycle(billingData) {
    try {
      console.log('🚀 Starting billing cycle creation...');

      // Step 1: Get customer information
      const customer = await this.prisma.customer.findUnique({
        where: { id: billingData.customerId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Step 2: Create or find Zoho customer
      let zohoCustomer = await this.zohoService.findCustomerByEmail(customer.email);
      
      if (!zohoCustomer) {
        console.log('📝 Creating Zoho customer...');
        zohoCustomer = await this.zohoService.createCustomer({
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
          billing_address: {
            address: customer.addressLine1,
            city: customer.city,
            state: customer.state,
            zip: customer.postcode,
            country: customer.countryOfResidence
          }
        });
      }

      // Step 3: Create Zoho invoice
      console.log('📄 Creating Zoho invoice...');
      const zohoInvoice = await this.zohoService.createInvoice({
        customer_id: zohoCustomer.contact_id,
        line_items: billingData.items || [{
          name: billingData.description,
          quantity: 1,
          unit_price: billingData.amount / 100, // Convert from pence to currency
          tax_percentage: 0
        }],
        reference: billingData.reference || `INV-${Date.now()}`,
        notes: billingData.notes || '',
        terms: billingData.terms || 'Payment due on receipt'
      });

      // Step 4: Create GoCardless payment if mandate exists
      let goCardlessPayment = null;
      if (customer.goCardlessMandateId) {
        console.log('💳 Creating GoCardless payment...');
        goCardlessPayment = await this.goCardlessService.createPayment(
          customer.goCardlessMandateId,
          {
            amount: billingData.amount,
            currency: billingData.currency,
            description: billingData.description,
            reference: zohoInvoice.invoice_id,
            chargeDate: billingData.dueDate || new Date(),
            internalCustomerId: customer.id,
            invoiceId: zohoInvoice.invoice_id,
            metadata: {
              zoho_invoice_id: zohoInvoice.invoice_id
            }
          }
        );
      }

      // Step 5: Create billing history record
      console.log('💾 Creating billing history record...');
      const billingHistory = await this.prisma.billingHistory.create({
        data: {
          customerId: customer.id,
          goCardlessPaymentId: goCardlessPayment?.id || null,
          zohoInvoiceId: zohoInvoice.invoice_id,
          amount: billingData.amount / 100, // Convert from pence to decimal
          currency: billingData.currency,
          status: goCardlessPayment ? 'pending' : 'pending',
          description: billingData.description,
          dueDate: billingData.dueDate
        }
      });

      // Step 6: Create receipt record
      console.log('🧾 Creating receipt record...');
      
      let pdfUrl = null;
      try {
        pdfUrl = await this.zohoService.getInvoicePDF(zohoInvoice.invoice_id);
      } catch (error) {
        console.log('⚠️ PDF generation failed, will retry later:', error.message);
        // PDF might not be immediately available, we'll handle this gracefully
      }
      
      const receipt = await this.prisma.receipt.create({
        data: {
          billingHistoryId: billingHistory.id,
          customerId: customer.id,
          goCardlessPaymentId: goCardlessPayment?.id || null,
          zohoInvoiceId: zohoInvoice.invoice_id,
          fileName: `invoice-${zohoInvoice.invoice_id}.pdf`,
          fileUrl: pdfUrl,
          fileSize: null,
          mimeType: 'application/pdf'
        }
      });

      console.log('✅ Billing cycle created successfully!');
      
      return {
        billingHistory,
        receipt,
        zohoInvoice,
        goCardlessPayment
      };

    } catch (error) {
      console.error('❌ Error creating billing cycle:', error);
      throw error;
    }
  }

  /**
   * Process GoCardless webhook and update billing records
   * @param {Object} webhookData - GoCardless webhook data
   * @returns {Promise<Object>} Processing result
   */
  async processGoCardlessWebhook(webhookData) {
    try {
      console.log('🔄 Processing GoCardless webhook...');
      
      const processedEvents = await this.goCardlessService.processWebhook(webhookData);
      
      for (const event of processedEvents.events) {
        if (event.resource_type === 'payments') {
          // Update billing history status
          const billingHistory = await this.prisma.billingHistory.findFirst({
            where: { goCardlessPaymentId: event.resource_id }
          });

          if (billingHistory) {
            await this.prisma.billingHistory.update({
              where: { id: billingHistory.id },
              data: {
                status: event.status,
                paidAt: event.status === 'paid' ? new Date() : null,
                updatedAt: new Date()
              }
            });

            // If payment is confirmed, update Zoho invoice status
            if (event.status === 'paid' && billingHistory.zohoInvoiceId) {
              await this.zohoService.updateInvoiceStatus(billingHistory.zohoInvoiceId, 'paid');
            }

            console.log(`✅ Updated billing record ${billingHistory.id} to status: ${event.status}`);
          }
        }
      }

      return processedEvents;

    } catch (error) {
      console.error('❌ Error processing GoCardless webhook:', error);
      throw error;
    }
  }

  /**
   * Sync billing data from external services
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Sync result
   */
  async syncBillingData(customerId) {
    try {
      console.log('🔄 Syncing billing data for customer:', customerId);

      // Check cache first
      const cacheKey = `sync-${customerId}`;
      const cachedResult = this.syncCache.get(cacheKey);
      
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.CACHE_DURATION) {
        console.log('📋 Returning cached sync result for customer:', customerId);
        return cachedResult.data;
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          billingHistory: {
            include: {
              receipts: true
            }
          }
        }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const syncResults = {
        zohoInvoices: [],
        goCardlessPayments: [],
        updatedRecords: 0
      };

      // Sync Zoho invoices
      if (customer.email) {
        const zohoCustomer = await this.zohoService.findCustomerByEmail(customer.email);
        if (zohoCustomer) {
          const zohoInvoices = await this.zohoService.getInvoicesByCustomer(zohoCustomer.contact_id);
          
          for (const invoice of zohoInvoices) {
            // Check if invoice already exists in our database
            const existingBilling = await this.prisma.billingHistory.findFirst({
              where: { zohoInvoiceId: invoice.invoice_id }
            });

            if (!existingBilling) {
              // Create new billing record
              const billingHistory = await this.prisma.billingHistory.create({
                data: {
                  customerId: customer.id,
                  zohoInvoiceId: invoice.invoice_id,
                  amount: parseFloat(invoice.total),
                  currency: invoice.currency_code,
                  status: invoice.status === 'paid' ? 'paid' : 'pending',
                  description: invoice.reference || 'Zoho Invoice',
                  dueDate: new Date(invoice.due_date),
                  paidAt: invoice.status === 'paid' ? new Date(invoice.paid_at) : null
                }
              });

              // Create receipt record
              await this.prisma.receipt.create({
                data: {
                  billingHistoryId: billingHistory.id,
                  customerId: customer.id,
                  zohoInvoiceId: invoice.invoice_id,
                  fileName: `invoice-${invoice.invoice_id}.pdf`,
                  fileUrl: await this.zohoService.getInvoicePDF(invoice.invoice_id),
                  mimeType: 'application/pdf'
                }
              });

              syncResults.zohoInvoices.push(invoice.invoice_id);
              syncResults.updatedRecords++;
            }
          }
        }
      }

      // Sync GoCardless payments
      if (customer.goCardlessMandateId) {
        try {
          const goCardlessPayments = await this.goCardlessService.listPayments(customer.goCardlessMandateId);
          
          // Ensure goCardlessPayments is an array
          const payments = Array.isArray(goCardlessPayments) ? goCardlessPayments : (goCardlessPayments?.payments || []);
          
          for (const payment of payments) {
            // Check if payment already exists in our database
            const existingBilling = await this.prisma.billingHistory.findFirst({
              where: { goCardlessPaymentId: payment.id }
            });

            if (!existingBilling) {
              // Create new billing record
              await this.prisma.billingHistory.create({
                data: {
                  customerId: customer.id,
                  goCardlessPaymentId: payment.id,
                  amount: payment.amount / 100, // Convert from pence
                  currency: payment.currency,
                  status: payment.status,
                  description: payment.description,
                  dueDate: new Date(payment.charge_date),
                  paidAt: payment.status === 'confirmed' ? new Date(payment.charge_date) : null
                }
              });

              syncResults.goCardlessPayments.push(payment.id);
              syncResults.updatedRecords++;
            }
          }
        } catch (error) {
          console.error('Error syncing GoCardless payments:', error);
          // Continue with other sync operations even if GoCardless fails
        }
      }

      // Cache the result
      this.syncCache.set(cacheKey, {
        data: syncResults,
        timestamp: Date.now()
      });

      console.log('✅ Billing data sync completed');
      return syncResults;

    } catch (error) {
      console.error('❌ Error syncing billing data:', error);
      throw error;
    }
  }

  /**
   * Clear sync cache for a specific customer
   * @param {string} customerId - Customer ID
   */
  clearSyncCache(customerId) {
    const cacheKey = `sync-${customerId}`;
    this.syncCache.delete(cacheKey);
    console.log('🗑️ Cleared sync cache for customer:', customerId);
  }

  /**
   * Clear all sync cache
   */
  clearAllSyncCache() {
    this.syncCache.clear();
    console.log('🗑️ Cleared all sync cache');
  }

  /**
   * Get comprehensive billing summary for a customer
   * @param {string} customerId - Customer ID
   * @returns {Promise<Object>} Billing summary
   */
  async getBillingSummary(customerId) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          billingHistory: {
            include: {
              receipts: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const billingHistory = customer.billingHistory;
      
      const summary = {
        totalBills: billingHistory.length,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        failedAmount: 0,
        currency: 'GBP',
        recentBills: billingHistory.slice(0, 5),
        statusBreakdown: {
          paid: 0,
          pending: 0,
          failed: 0,
          cancelled: 0
        }
      };

      for (const bill of billingHistory) {
        const amount = parseFloat(bill.amount);
        summary.totalAmount += amount;
        
        switch (bill.status) {
          case 'paid':
            summary.paidAmount += amount;
            summary.statusBreakdown.paid++;
            break;
          case 'pending':
            summary.pendingAmount += amount;
            summary.statusBreakdown.pending++;
            break;
          case 'failed':
            summary.failedAmount += amount;
            summary.statusBreakdown.failed++;
            break;
          case 'cancelled':
            summary.statusBreakdown.cancelled++;
            break;
        }
      }

      return summary;

    } catch (error) {
      console.error('Error getting billing summary:', error);
      throw error;
    }
  }
}

module.exports = BillingIntegrationService; 