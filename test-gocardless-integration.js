/**
 * Test script for GoCardless integration with customer registration flow
 * Run with: node test-gocardless-integration.js
 */

require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testGoCardlessIntegration() {
  console.log('🧪 Testing GoCardless Integration Flow...\n');

  // Environment check
  console.log('📋 Environment Configuration:');
  console.log('GOCARDLESS_ACCESS_TOKEN:', process.env.GOCARDLESS_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('GOCARDLESS_ENVIRONMENT:', process.env.GOCARDLESS_ENVIRONMENT || 'sandbox (default)');
  console.log('');

  if (!process.env.GOCARDLESS_ACCESS_TOKEN || process.env.GOCARDLESS_ACCESS_TOKEN === 'your_gocardless_access_token_here') {
    console.log('❌ Please set your GoCardless access token in .env file');
    console.log('You can get your sandbox token from: https://manage-sandbox.gocardless.com/developers');
    return;
  }

  try {
    const goCardlessService = new GoCardlessService();
    console.log('✅ GoCardless service initialized\n');

    // Test data that matches our form structure
    const testCustomerData = {
      email: `test-${Date.now()}@example.com`,
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'Test Company Ltd',
      phone: '+441234567890',
      countryOfResidence: 'GB',
      internalId: `test-customer-${Date.now()}`,
      address: {
        line1: '123 Test Street',
        line2: 'Test Area',
        city: 'London',
        postcode: 'SW1A 1AA',
        state: null
      }
    };

    const bankDetails = {
      accountHolderName: 'John Doe',
      bankCode: '200000', // Test sort code for UK
      accountNumber: '55779911', // Test account number
      accountType: 'checking',
      countryCode: 'GB'
    };

    console.log('🔄 Step 1: Creating GoCardless customer...');
    const customer = await goCardlessService.createCustomer(testCustomerData);
    console.log('✅ Customer created:', {
      id: customer.id,
      email: customer.email,
      given_name: customer.given_name,
      family_name: customer.family_name
    });
    console.log('');

    console.log('🔄 Step 2: Creating customer bank account...');
    const customerBankAccount = await goCardlessService.createCustomerBankAccount(customer.id, bankDetails);
    console.log('✅ Bank account created:', {
      id: customerBankAccount.id,
      account_holder_name: customerBankAccount.account_holder_name,
      account_number_ending: customerBankAccount.account_number_ending,
      bank_name: customerBankAccount.bank_name
    });
    console.log('');

    console.log('🔄 Step 3: Creating mandate...');
    const mandateData = {
      reference: `TEST-MANDATE-${Date.now()}`,
      scheme: 'bacs'
    };
    const mandate = await goCardlessService.createMandate(customerBankAccount.id, mandateData);
    console.log('✅ Mandate created:', {
      id: mandate.id,
      reference: mandate.reference,
      status: mandate.status,
      scheme: mandate.scheme
    });
    console.log('');

    console.log('🔄 Step 4: Retrieving customer details...');
    const fetchedCustomer = await goCardlessService.getCustomer(customer.id);
    console.log('✅ Customer details retrieved:', {
      id: fetchedCustomer.id,
      email: fetchedCustomer.email,
      created_at: fetchedCustomer.created_at
    });
    console.log('');

    console.log('🔄 Step 5: Retrieving mandate details...');
    const fetchedMandate = await goCardlessService.getMandate(mandate.id);
    console.log('✅ Mandate details retrieved:', {
      id: fetchedMandate.id,
      status: fetchedMandate.status,
      created_at: fetchedMandate.created_at
    });
    console.log('');

    console.log('🎉 All tests passed! GoCardless integration is working correctly.');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Update your .env file with your actual GoCardless access token');
    console.log('2. Test the registration flow through your frontend');
    console.log('3. Monitor the mandate status in your GoCardless dashboard');
    console.log('4. Test error handling with invalid bank details');
    console.log('');
    console.log('🔗 GoCardless Dashboard:', process.env.GOCARDLESS_ENVIRONMENT === 'live' 
      ? 'https://manage.gocardless.com/' 
      : 'https://manage-sandbox.gocardless.com/');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.error('1. Check your GoCardless access token');
    console.error('2. Verify your environment settings');
    console.error('3. Check network connectivity');
    console.error('4. Check the GoCardless API status');
    console.log('');
    console.log('📖 GoCardless API Docs: https://developer.gocardless.com/api-reference/');
  }
}

// Run the test
testGoCardlessIntegration();