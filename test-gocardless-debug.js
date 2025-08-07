require('dotenv').config();
const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');

async function debugGoCardlessClient() {
  console.log('🔍 Debugging GoCardless Client...\n');
  
  try {
    // Initialize GoCardless client
    const client = gocardless(
      process.env.GOCARDLESS_ACCESS_TOKEN,
      process.env.GOCARDLESS_ENVIRONMENT === 'live' 
        ? constants.Environments.Live 
        : constants.Environments.Sandbox,
      { 
        raiseOnIdempotencyConflict: false
      }
    );
    
    console.log('✅ GoCardless client initialized');
    console.log('Available services:', Object.keys(client));
    
    // Try to access services directly
    console.log('\n🔍 Trying direct access:');
    console.log('client.customers:', typeof client.customers);
    console.log('client.customerBankAccounts:', typeof client.customerBankAccounts);
    console.log('client.mandates:', typeof client.mandates);
    console.log('client.payments:', typeof client.payments);
    
    // Try to access with underscore
    console.log('\n🔍 Trying underscore access:');
    console.log('client._customers:', typeof client._customers);
    console.log('client._customerBankAccounts:', typeof client._customerBankAccounts);
    console.log('client._mandates:', typeof client._mandates);
    console.log('client._payments:', typeof client._payments);
    
    // Check if there's a different way to access
    console.log('\n🔍 Checking client prototype:');
    console.log('Object.getPrototypeOf(client):', Object.keys(Object.getPrototypeOf(client)));
    
    // Try to find the actual service methods
    console.log('\n🔍 Looking for service methods:');
    for (const key of Object.keys(client)) {
      if (key.includes('customer') || key.includes('mandate') || key.includes('payment')) {
        console.log(`${key}:`, typeof client[key], client[key] ? Object.keys(client[key]) : 'undefined');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugGoCardlessClient().catch(console.error); 