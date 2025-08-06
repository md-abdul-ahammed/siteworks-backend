require('dotenv').config();
const axios = require('axios');

async function testOpenPhoneAPI() {
  console.log('=== Testing OpenPhone API Connection ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  console.log('API Key length:', apiKey ? apiKey.length : 0);
  console.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'Not found');
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  try {
    // Test 1: Try to get contacts (this should work if API key is valid)
    console.log('\n1. Testing API key with GET /contacts...');
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ API key is valid!');
    console.log('Response status:', response.status);
    console.log('Contacts count:', response.data.contacts ? response.data.contacts.length : 'N/A');
    
  } catch (error) {
    console.log('❌ API key test failed');
    console.log('Error status:', error.response?.status);
    console.log('Error message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔍 The API key appears to be invalid or expired.');
      console.log('Please check:');
      console.log('1. The API key is correct');
      console.log('2. The API key has the right permissions');
      console.log('3. The API key is not expired');
    }
  }
  
  // Test 2: Try a different endpoint
  try {
    console.log('\n2. Testing API key with GET /user...');
    const userResponse = await axios.get(`${baseUrl}/user`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ User endpoint works!');
    console.log('User info:', userResponse.data);
    
  } catch (error) {
    console.log('❌ User endpoint failed');
    console.log('Error:', error.response?.data?.message || error.message);
  }
}

testOpenPhoneAPI().catch(console.error); 