require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testUSGoCardlessFix() {
  console.log('🧪 Testing US GoCardless Fix (USD Account + ACH Mandate)');
  console.log('==========================================================');
  
  const goCardlessService = new GoCardlessService();
  
  try {
    // Test US customer with USD bank account
    const customerData = {
      email: 'test-us-fix@example.com',
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'US Test Company',
      phone: '+12345678901',
      countryOfResidence: 'US',
      address: {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        postcode: '10001',
        state: 'NY'
      },
      internalId: 'test-us-fix-001'
    };

    const bankDetails = {
      accountHolderName: 'John Doe',
      bankCode: '021000021', // Chase Bank routing number
      accountNumber: '123456789',
      accountType: 'checking',
      countryCode: 'US',
      internalCustomerId: 'test-us-fix-001'
    };

    console.log('1️⃣ Creating US customer...');
    const customer = await goCardlessService.createCustomer(customerData);
    console.log('✅ Customer created:', customer.id);
    console.log('   Country:', customer.country_code);
    
    console.log('\n2️⃣ Creating USD bank account...');
    const bankAccount = await goCardlessService.createCustomerBankAccount(
      customer.id,
      bankDetails
    );
    console.log('✅ Bank account created:', bankAccount.id);
    console.log('   Currency:', bankAccount.currency);
    console.log('   Country:', bankAccount.country_code);
    
    console.log('\n3️⃣ Creating ACH mandate...');
    const mandate = await goCardlessService.createMandate(
      bankAccount.id,
      {
        countryCode: 'US',
        internalCustomerId: 'test-us-fix-001',
        payerIpAddress: '8.8.8.8'
      }
    );
    console.log('✅ Mandate created:', mandate.id);
    console.log('   Scheme:', mandate.scheme);
    console.log('   Status:', mandate.status);
    
    console.log('\n4️⃣ Creating USD payment...');
    const payment = await goCardlessService.createPayment(
      mandate.id,
      {
        amount: 1000, // 1000 cents = $10.00
        currency: 'USD',
        description: 'Test USD payment',
        reference: `TEST-USD-${Date.now()}`,
        chargeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        internalCustomerId: 'test-us-fix-001'
      }
    );
    console.log('✅ Payment created:', payment.id);
    console.log('   Amount:', payment.amount, payment.currency);
    console.log('   Status:', payment.status);
    
    console.log('\n🎉 US GoCardless Fix - ALL TESTS PASSED!');
    console.log('✅ USD bank account + ACH mandate working correctly');
    
  } catch (error) {
    console.error('❌ US GoCardless Fix - FAILED:');
    console.error('Error:', error.message);
    
    if (error.errors) {
      console.error('Validation errors:');
      error.errors.forEach(err => {
        console.error(`  - ${err.field}: ${err.message}`);
      });
    }
    
    if (error.response) {
      console.error('Response status:', error.response.statusCode);
      console.error('Response body:', error.response.body);
    }
  }
}

// Run the test
testUSGoCardlessFix()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }); 