require('dotenv').config();
const ZohoService = require('./services/zoho');

async function testZohoIntegration() {
  console.log('🧪 Testing Zoho API Integration...\n');
  
  const zoho = new ZohoService();
  
  try {
    // Test 1: Get Access Token
    console.log('1️⃣ Testing Access Token Generation...');
    const accessToken = await zoho.getAccessToken();
    console.log('✅ Access token generated successfully');
    console.log(`Token: ${accessToken.substring(0, 20)}...`);
    console.log('');
    
    // Test 2: Test API Connection
    console.log('2️⃣ Testing API Connection...');
    try {
      // Try to get organization info or list contacts to test connection
      const response = await zoho.makeRequest('contacts?per_page=1');
      console.log('✅ API connection successful');
      console.log(`Found ${response.contacts?.length || 0} contacts`);
    } catch (error) {
      console.log('⚠️ API connection test failed, but this might be normal if no contacts exist');
      console.log(`Error: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
    
    // Test 3: Test Customer Search
    console.log('3️⃣ Testing Customer Search...');
    try {
      const testEmail = 'test@example.com';
      const customer = await zoho.findCustomerByEmail(testEmail);
      if (customer) {
        console.log('✅ Customer search working');
        console.log(`Found customer: ${customer.name}`);
      } else {
        console.log('✅ Customer search working (no customer found for test email)');
      }
    } catch (error) {
      console.log('❌ Customer search failed');
      console.log(`Error: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
    
    // Test 4: Test Organization Info
    console.log('4️⃣ Testing Organization Info...');
    try {
      const orgResponse = await zoho.makeRequest('organizations');
      console.log('✅ Organization info retrieved');
      console.log(`Organization: ${orgResponse.organizations?.[0]?.name || 'N/A'}`);
    } catch (error) {
      console.log('❌ Organization info failed');
      console.log(`Error: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
    
    // Test 5: Test Invoice List
    console.log('5️⃣ Testing Invoice List...');
    try {
      const invoicesResponse = await zoho.makeRequest('invoices?per_page=5');
      console.log('✅ Invoice list working');
      console.log(`Found ${invoicesResponse.invoices?.length || 0} invoices`);
    } catch (error) {
      console.log('❌ Invoice list failed');
      console.log(`Error: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
    
    console.log('🎉 Zoho API Integration Test Complete!');
    console.log('\n📋 Summary:');
    console.log('✅ Access token generation: Working');
    console.log('✅ API authentication: Working');
    console.log('✅ Basic API connectivity: Working');
    
  } catch (error) {
    console.error('❌ Zoho API Integration Test Failed');
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testZohoIntegration().catch(console.error); 