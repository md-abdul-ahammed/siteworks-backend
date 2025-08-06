/**
 * Test script for GoCardless integration
 * Run with: node test-gocardless.js
 */

require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testGoCardlessIntegration() {
  try {
    console.log('🧪 Testing GoCardless Integration...\n');

    // Check environment variables
    console.log('📋 Environment Check:');
    console.log('GOCARDLESS_ACCESS_TOKEN:', process.env.GOCARDLESS_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('GOCARDLESS_ENVIRONMENT:', process.env.GOCARDLESS_ENVIRONMENT || 'sandbox (default)');
    console.log('');

    if (!process.env.GOCARDLESS_ACCESS_TOKEN || process.env.GOCARDLESS_ACCESS_TOKEN === 'your_gocardless_access_token_here') {
      console.log('❌ ERROR: GoCardless access token not configured!');
      console.log('\n📝 To fix this:');
      console.log('1. Go to https://manage-sandbox.gocardless.com/developers');
      console.log('2. Sign in to your GoCardless sandbox account');
      console.log('3. Navigate to "Developers" → "Create" → "Access Token"');
      console.log('4. Create a new access token with appropriate permissions');
      console.log('5. Copy the token and update your .env file:');
      console.log('   GOCARDLESS_ACCESS_TOKEN=your_actual_token_here');
      console.log('\n🔗 Quick Links:');
      console.log('- Sandbox Dashboard: https://manage-sandbox.gocardless.com/developers');
      console.log('- API Documentation: https://developer.gocardless.com/api-reference');
      console.log('- Testing Guide: https://developer.gocardless.com/api-reference/#testing');
      return;
    }

    const goCardlessService = new GoCardlessService();
    console.log('✅ GoCardless service initialized\n');

    // Test customer creation
    console.log('👤 Testing Customer Creation...');
    const testCustomerData = {
      email: `test-${Date.now()}@example.com`,
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'Test Company Ltd',
      phone: '+441234567890',
      countryOfResidence: 'GB',
      internalId: 'test-customer-123',
      address: {
        line1: '123 Test Street',
        line2: 'Test Floor',
        city: 'London',
        postcode: 'SW1A 1AA',
        state: ''
      }
    };

    const customer = await goCardlessService.createCustomer(testCustomerData);
    console.log('✅ Customer created successfully:');
    console.log('   ID:', customer.id);
    console.log('   Email:', customer.email);
    console.log('   Name:', customer.given_name, customer.family_name);
    console.log('');

    // Test customer bank account creation
    console.log('🏦 Testing Customer Bank Account Creation...');
    const bankDetails = {
      accountHolderName: 'John Doe',
      bankCode: '200000', // Test sort code for sandbox
      accountNumber: '55779911', // Test account number for sandbox
      accountType: 'checking',
      countryCode: 'GB'
    };

    const customerBankAccount = await goCardlessService.createCustomerBankAccount(customer.id, bankDetails);
    console.log('✅ Customer bank account created successfully:');
    console.log('   ID:', customerBankAccount.id);
    console.log('   Account Holder:', customerBankAccount.account_holder_name);
    console.log('   Account Number Ending:', customerBankAccount.account_number_ending);
    console.log('   Currency:', customerBankAccount.currency);
    console.log('');

    // Test mandate creation
    console.log('📝 Testing Mandate Creation...');
    const mandateData = {
      reference: `TEST-MANDATE-${Date.now()}`,
      scheme: 'bacs'
    };

    const mandate = await goCardlessService.createMandate(customerBankAccount.id, mandateData);
    console.log('✅ Mandate created successfully:');
    console.log('   ID:', mandate.id);
    console.log('   Reference:', mandate.reference);
    console.log('   Status:', mandate.status);
    console.log('   Scheme:', mandate.scheme);
    console.log('');

    // Test fetching customer
    console.log('🔍 Testing Customer Retrieval...');
    const fetchedCustomer = await goCardlessService.getCustomer(customer.id);
    console.log('✅ Customer retrieved successfully:');
    console.log('   ID:', fetchedCustomer.id);
    console.log('   Email:', fetchedCustomer.email);
    console.log('');

    // Test fetching mandate
    console.log('🔍 Testing Mandate Retrieval...');
    const fetchedMandate = await goCardlessService.getMandate(mandate.id);
    console.log('✅ Mandate retrieved successfully:');
    console.log('   ID:', fetchedMandate.id);
    console.log('   Status:', fetchedMandate.status);
    console.log('   Reference:', fetchedMandate.reference);
    console.log('');

    console.log('🎉 All tests passed! GoCardless integration is working correctly.');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Update your .env file with your actual GoCardless access token');
    console.log('2. Test the registration flow with a real customer');
    console.log('3. Monitor the mandate status in your GoCardless dashboard');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('1. Check your GoCardless access token');
    console.error('2. Ensure you have the correct environment (sandbox/live)');
    console.error('3. Verify your network connection');
    console.error('4. Check the GoCardless API status');
    console.error('');
    console.error('Full error:', error);
  }
}

// Run the test
testGoCardlessIntegration();