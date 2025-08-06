require('dotenv').config();
const axios = require('axios');

async function comprehensiveOpenPhoneTest() {
  console.log('=== Comprehensive OpenPhone API Test ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  console.log('🔑 API Key Details:');
  console.log('- Length:', apiKey ? apiKey.length : 0);
  console.log('- First 10 chars:', apiKey ? apiKey.substring(0, 10) + '...' : 'Not found');
  console.log('- Last 10 chars:', apiKey ? '...' + apiKey.substring(apiKey.length - 10) : 'Not found');
  
  if (!apiKey) {
    console.log('❌ No API key found in environment variables');
    return;
  }
  
  // Test 1: Basic API connectivity
  console.log('\n🔍 Test 1: Basic API Connectivity');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    console.log('✅ API is accessible and key is valid');
    console.log('Response status:', response.status);
    console.log('Contacts count:', response.data.contacts ? response.data.contacts.length : 'N/A');
  } catch (error) {
    console.log('❌ API connectivity failed');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔍 401 Unauthorized Analysis:');
      console.log('This means your API key is:');
      console.log('1. ❌ Invalid or expired');
      console.log('2. ❌ Missing required permissions');
      console.log('3. ❌ Not activated yet');
      console.log('4. ❌ From wrong environment (sandbox vs production)');
    }
  }
  
  // Test 2: Try different API endpoints
  console.log('\n🔍 Test 2: Different API Endpoints');
  const endpoints = [
    '/user',
    '/account',
    '/workspace',
    '/teams',
    '/numbers'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      console.log(`✅ ${endpoint} - Works`);
    } catch (error) {
      console.log(`❌ ${endpoint} - Failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Test 3: Check API documentation
  console.log('\n🔍 Test 3: API Documentation Check');
  try {
    const response = await axios.get('https://api.openphone.com/docs');
    console.log('✅ API documentation is accessible');
  } catch (error) {
    console.log('❌ Cannot access API documentation');
  }
  
  // Test 4: Try different authentication methods
  console.log('\n🔍 Test 4: Alternative Authentication Methods');
  
  const authMethods = [
    { name: 'Bearer Token', header: { 'Authorization': `Bearer ${apiKey}` } },
    { name: 'API Key Header', header: { 'X-API-Key': apiKey } },
    { name: 'API Key Header 2', header: { 'X-OpenPhone-API-Key': apiKey } },
    { name: 'API Key Header 3', header: { 'OpenPhone-API-Key': apiKey } }
  ];
  
  for (const method of authMethods) {
    try {
      const response = await axios.get(`${baseUrl}/contacts`, {
        headers: {
          ...method.header,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      console.log(`✅ ${method.name} - Works`);
    } catch (error) {
      console.log(`❌ ${method.name} - Failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  console.log('\n=== Test Complete ===');
  console.log('\n💡 Recommendations:');
  console.log('1. Check your OpenPhone account plan (API might require paid plan)');
  console.log('2. Verify API access is enabled in your account settings');
  console.log('3. Generate a new API key with explicit permissions');
  console.log('4. Contact OpenPhone support about API key permissions');
  console.log('5. Check if you need to activate your account for API access');
}

comprehensiveOpenPhoneTest().catch(console.error); 