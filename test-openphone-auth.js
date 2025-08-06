require('dotenv').config();
const axios = require('axios');

async function testDifferentAuthMethods() {
  console.log('=== Testing Different OpenPhone Authentication Methods ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  console.log('API Key:', apiKey ? 'Found' : 'Not found');
  
  // Test 1: Bearer token (current method)
  console.log('\n1. Testing Bearer token authentication...');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Bearer token works!');
  } catch (error) {
    console.log('❌ Bearer token failed:', error.response?.data?.message || error.message);
  }
  
  // Test 2: API key in header (alternative method)
  console.log('\n2. Testing API key in header...');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ API key in header works!');
  } catch (error) {
    console.log('❌ API key in header failed:', error.response?.data?.message || error.message);
  }
  
  // Test 3: Query parameter (some APIs use this)
  console.log('\n3. Testing API key as query parameter...');
  try {
    const response = await axios.get(`${baseUrl}/contacts?api_key=${apiKey}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ API key as query parameter works!');
  } catch (error) {
    console.log('❌ API key as query parameter failed:', error.response?.data?.message || error.message);
  }
  
  // Test 4: Check if API is available at all
  console.log('\n4. Testing API endpoint availability...');
  try {
    const response = await axios.get(`${baseUrl}/health`); // or /status
    console.log('✅ API endpoint is available');
  } catch (error) {
    console.log('❌ API endpoint not available:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== Authentication Test Complete ===');
  console.log('\n💡 If all methods fail, your API key likely needs:');
  console.log('1. Proper permissions (read/write contacts)');
  console.log('2. Account activation for API access');
  console.log('3. Different authentication method');
}

testDifferentAuthMethods().catch(console.error); 