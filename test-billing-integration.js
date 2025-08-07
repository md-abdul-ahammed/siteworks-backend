require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const BillingIntegrationService = require('./services/billingIntegration');

const prisma = new PrismaClient();
const billingService = new BillingIntegrationService();

async function testBillingIntegration() {
  try {
    console.log('🔍 Testing Billing Integration with Real Data...\n');
    
    // Test 1: Get a customer from database
    console.log('1️⃣ Finding a customer in database...');
    const customer = await prisma.customer.findFirst({
      where: {
        email: {
          not: null
        }
      }
    });
    
    if (!customer) {
      console.log('❌ No customers found in database');
      console.log('   Please create a customer first or check your database');
      return;
    }
    
    console.log('✅ Found customer:', {
      id: customer.id,
      email: customer.email,
      name: `${customer.firstName} ${customer.lastName}`
    });
    
    // Test 2: Sync billing data for this customer
    console.log('\n2️⃣ Syncing billing data from Zoho...');
    try {
      const syncResult = await billingService.syncBillingData(customer.id);
      console.log('✅ Sync completed:', {
        zohoInvoices: syncResult.zohoInvoices.length,
        goCardlessPayments: syncResult.goCardlessPayments.length,
        updatedRecords: syncResult.updatedRecords
      });
      
      if (syncResult.zohoInvoices.length > 0) {
        console.log('   📄 Zoho Invoices found:', syncResult.zohoInvoices);
      }
      
      if (syncResult.goCardlessPayments.length > 0) {
        console.log('   💳 GoCardless Payments found:', syncResult.goCardlessPayments);
      }
      
    } catch (error) {
      console.log('❌ Sync failed:', error.message);
      console.log('   This might be because:');
      console.log('   - Customer email not found in Zoho');
      console.log('   - Zoho API rate limit reached');
      console.log('   - Network connectivity issues');
    }
    
    // Test 3: Get billing summary
    console.log('\n3️⃣ Getting billing summary...');
    try {
      const summary = await billingService.getBillingSummary(customer.id);
      console.log('✅ Billing Summary:', {
        totalBills: summary.totalBills,
        totalAmount: summary.totalAmount,
        paidAmount: summary.paidAmount,
        pendingAmount: summary.pendingAmount,
        currency: summary.currency
      });
      
      if (summary.recentBills && summary.recentBills.length > 0) {
        console.log('   📋 Recent Bills:');
        summary.recentBills.forEach((bill, index) => {
          console.log(`     ${index + 1}. ${bill.description || 'No description'} - ${bill.amount} ${bill.currency} - ${bill.status}`);
        });
      }
      
    } catch (error) {
      console.log('❌ Failed to get billing summary:', error.message);
    }
    
    // Test 4: Check billing history in database
    console.log('\n4️⃣ Checking billing history in database...');
    const billingHistory = await prisma.billingHistory.findMany({
      where: {
        customerId: customer.id
      },
      include: {
        receipts: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log(`✅ Found ${billingHistory.length} billing records in database`);
    
    if (billingHistory.length > 0) {
      console.log('   📋 Recent Billing Records:');
      billingHistory.forEach((record, index) => {
        console.log(`     ${index + 1}. ${record.description || 'No description'}`);
        console.log(`        Amount: ${record.amount} ${record.currency}`);
        console.log(`        Status: ${record.status}`);
        console.log(`        Zoho Invoice ID: ${record.zohoInvoiceId || 'N/A'}`);
        console.log(`        Receipts: ${record.receipts.length}`);
        console.log('');
      });
    }
    
    console.log('\n✅ Billing Integration Test Complete!');
    console.log('\n📝 Summary:');
    console.log('   - Customer found in database');
    console.log('   - Zoho sync attempted');
    console.log('   - Billing summary retrieved');
    console.log('   - Database records checked');
    console.log('\n💡 Next Steps:');
    console.log('   1. Check if customer email exists in Zoho');
    console.log('   2. If not, create customer in Zoho first');
    console.log('   3. Run sync again to fetch billing data');
    console.log('   4. Test the frontend billing dashboard');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBillingIntegration(); 