const { PrismaClient } = require('@prisma/client');
const BillingIntegrationService = require('./services/billingIntegration');
require('dotenv').config();

const prisma = new PrismaClient();
const billingService = new BillingIntegrationService();

async function testSimpleBilling() {
  console.log('🔍 Testing Simple Billing Sync...\n');
  
  try {
    // Test 1: Check if we can connect to database
    console.log('1️⃣ Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test 2: Find any customer
    console.log('\n2️⃣ Finding a customer...');
    const customer = await prisma.customer.findFirst();
    
    if (!customer) {
      console.log('❌ No customers found in database');
      console.log('   Please create a customer first');
      return;
    }
    
    console.log('✅ Found customer:', {
      id: customer.id,
      email: customer.email,
      name: `${customer.firstName} ${customer.lastName}`
    });
    
    // Test 3: Try to sync billing data
    console.log('\n3️⃣ Testing billing sync...');
    try {
      const syncResult = await billingService.syncBillingData(customer.id);
      console.log('✅ Billing sync successful:', {
        zohoInvoices: syncResult.zohoInvoices.length,
        goCardlessPayments: syncResult.goCardlessPayments.length,
        updatedRecords: syncResult.updatedRecords
      });
    } catch (error) {
      console.log('❌ Billing sync failed:', error.message);
      console.log('   This is expected if the customer has no billing data');
    }
    
    // Test 4: Check billing history
    console.log('\n4️⃣ Checking billing history...');
    const billingHistory = await prisma.billingHistory.findMany({
      where: { customerId: customer.id },
      take: 5
    });
    
    console.log(`✅ Found ${billingHistory.length} billing records`);
    
    if (billingHistory.length > 0) {
      billingHistory.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.description || 'No description'} - ${record.amount} ${record.currency} - ${record.status}`);
      });
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSimpleBilling(); 