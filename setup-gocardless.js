#!/usr/bin/env node

/**
 * GoCardless Setup Script
 * This script helps configure and test GoCardless integration
 */

require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

console.log('🔧 GoCardless Setup Script');
console.log('==========================\n');

// Check environment variables
console.log('📋 Environment Configuration:');
console.log('GOCARDLESS_ACCESS_TOKEN:', process.env.GOCARDLESS_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
console.log('GOCARDLESS_ENVIRONMENT:', process.env.GOCARDLESS_ENVIRONMENT || '❌ Missing');

if (!process.env.GOCARDLESS_ACCESS_TOKEN || process.env.GOCARDLESS_ACCESS_TOKEN === 'your_gocardless_access_token_here') {
  console.log('\n❌ ERROR: GoCardless access token not configured!');
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
  process.exit(1);
}

// Test GoCardless connection
async function testGoCardlessConnection() {
  console.log('\n🧪 Testing GoCardless Connection...');
  
  try {
    const goCardlessService = new GoCardlessService();
    
    // Test by listing customers (should work even if empty)
    const customers = await goCardlessService.listCustomers({ limit: 1 });
    
    console.log('✅ GoCardless connection successful!');
    console.log(`📊 Found ${customers.customers.length} existing customers`);
    
    // Test customer creation with sample data
    console.log('\n🧪 Testing customer creation...');
    
    const testCustomerData = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'Customer',
      companyName: 'Test Company',
      phone: '+44123456789',
      countryOfResidence: 'GB',
      address: {
        line1: '123 Test Street',
        line2: 'Test Area',
        city: 'London',
        postcode: 'SW1A 1AA',
        state: 'England'
      },
      internalId: 'test-customer-' + Date.now()
    };
    
    const customer = await goCardlessService.createCustomer(testCustomerData);
    console.log('✅ Test customer created successfully!');
    console.log(`📋 Customer ID: ${customer.id}`);
    console.log(`📧 Email: ${customer.email}`);
    
    // Clean up - delete test customer
    console.log('\n🧹 Cleaning up test customer...');
    // Note: GoCardless doesn't provide a delete endpoint for customers
    // They will be automatically cleaned up in sandbox environment
    
    console.log('\n🎉 GoCardless integration is working correctly!');
    console.log('\n📝 Next Steps:');
    console.log('1. Your GoCardless integration is ready for testing');
    console.log('2. Test customer registration through your API');
    console.log('3. Monitor sandbox dashboard for created customers');
    console.log('4. When ready for production, switch to live environment');
    
  } catch (error) {
    console.error('\n❌ GoCardless connection failed:');
    console.error('Error:', error.message);
    
    if (error.code === 401) {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Verify your access token is correct');
      console.log('2. Ensure you\'re using sandbox token for sandbox environment');
      console.log('3. Check token permissions in GoCardless dashboard');
      console.log('4. Try regenerating the access token');
    }
    
    process.exit(1);
  }
}

// Run the test
testGoCardlessConnection().catch(console.error); 