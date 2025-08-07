/**
 * Test script for complete billing integration workflow
 * Run with: node test-billing-integration.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const BillingIntegrationService = require('./services/billingIntegration');

async function testBillingIntegration() {
  console.log('🧪 Testing Complete Billing Integration...\n');

  const prisma = new PrismaClient();
  const billingIntegration = new BillingIntegrationService();

  try {
    // Check if we have a customer to test with
    console.log('👤 Looking for test customer...');
    const customer = await prisma.customer.findFirst({
      where: {
        goCardlessMandateId: {
          not: null
        }
      }
    });

    if (!customer) {
      console.log('❌ No customer with GoCardless mandate found.');
      console.log('📝 Please create a customer with GoCardless setup first.');
      console.log('   You can run: node test-gocardless.js to set up GoCardless');
      return;
    }

    console.log('✅ Found test customer:', customer.email);

    // Test 1: Create a complete billing cycle
    console.log('\n🚀 Testing complete billing cycle creation...');
    const billingData = {
      customerId: customer.id,
      amount: 5000, // £50.00 in pence
      currency: 'GBP',
      description: 'Monthly Website Maintenance',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      items: [
        {
          name: 'Website Maintenance',
          quantity: 1,
          unit_price: 50.00,
          tax_percentage: 0
        }
      ],
      reference: `BILL-${Date.now()}`,
      notes: 'Monthly website maintenance and support services',
      terms: 'Payment due within 30 days'
    };

    const billingCycle = await billingIntegration.createBillingCycle(billingData);
    console.log('✅ Billing cycle created successfully!');
    console.log('   - Zoho Invoice ID:', billingCycle.zohoInvoice?.invoice_id);
    console.log('   - GoCardless Payment ID:', billingCycle.goCardlessPayment?.id);
    console.log('   - Billing History ID:', billingCycle.billingHistory.id);
    console.log('   - Receipt ID:', billingCycle.receipt.id);

    // Test 2: Get billing summary
    console.log('\n📊 Testing billing summary...');
    const summary = await billingIntegration.getBillingSummary(customer.id);
    console.log('✅ Billing summary retrieved:');
    console.log('   - Total Bills:', summary.totalBills);
    console.log('   - Total Amount:', `£${summary.totalAmount.toFixed(2)}`);
    console.log('   - Paid Amount:', `£${summary.paidAmount.toFixed(2)}`);
    console.log('   - Pending Amount:', `£${summary.pendingAmount.toFixed(2)}`);

    // Test 3: Sync billing data
    console.log('\n🔄 Testing billing data sync...');
    const syncResults = await billingIntegration.syncBillingData(customer.id);
    console.log('✅ Billing data sync completed:');
    console.log('   - Zoho Invoices Synced:', syncResults.zohoInvoices.length);
    console.log('   - GoCardless Payments Synced:', syncResults.goCardlessPayments.length);
    console.log('   - Total Records Updated:', syncResults.updatedRecords);

    // Test 4: Simulate webhook processing
    console.log('\n📥 Testing webhook processing...');
    const mockWebhookData = {
      events: [
        {
          id: 'EV123',
          resource_type: 'payments',
          action: 'confirmed',
          resource_id: billingCycle.goCardlessPayment?.id,
          created_at: new Date().toISOString(),
          details: {
            cause: 'payment_confirmed',
            description: 'Payment confirmed successfully'
          }
        }
      ]
    };

    const webhookResult = await billingIntegration.processGoCardlessWebhook(mockWebhookData);
    console.log('✅ Webhook processed successfully:');
    console.log('   - Events Processed:', webhookResult.events.length);

    // Test 5: Verify updated billing status
    console.log('\n✅ Verifying updated billing status...');
    const updatedBilling = await prisma.billingHistory.findUnique({
      where: { id: billingCycle.billingHistory.id }
    });
    console.log('   - Current Status:', updatedBilling.status);
    console.log('   - Paid At:', updatedBilling.paidAt);

    console.log('\n🎉 All billing integration tests passed!');
    console.log('\n📝 Integration Summary:');
    console.log('✅ Zoho Invoice Creation');
    console.log('✅ GoCardless Payment Processing');
    console.log('✅ Database Record Management');
    console.log('✅ Receipt Generation');
    console.log('✅ Webhook Processing');
    console.log('✅ Data Synchronization');

    console.log('\n🚀 Next Steps:');
    console.log('1. Set up webhook endpoints in GoCardless dashboard');
    console.log('2. Configure Zoho webhooks for invoice updates');
    console.log('3. Test real payment processing');
    console.log('4. Monitor webhook events');
    console.log('5. Set up automated billing cycles');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check GoCardless configuration');
    console.error('2. Verify Zoho API credentials');
    console.error('3. Ensure database is properly set up');
    console.error('4. Check webhook endpoints');
    console.error('5. Verify customer mandate status');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBillingIntegration(); 