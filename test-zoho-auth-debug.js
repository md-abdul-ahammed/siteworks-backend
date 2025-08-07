require('dotenv').config();
const axios = require('axios');

async function debugZohoAuth() {
  console.log('🔍 Debugging Zoho Authentication...\n');
  
  // Check environment variables
  console.log('1️⃣ Checking Environment Variables:');
  console.log(`ZOHO_CLIENT_ID: ${process.env.ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`ZOHO_CLIENT_SECRET: ${process.env.ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`ZOHO_REFRESH_TOKEN: ${process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`ZOHO_ORGANIZATION_ID: ${process.env.ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing'}`);
  console.log('');
  
  // Test the token refresh request manually
  console.log('2️⃣ Testing Token Refresh Request:');
  try {
    const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', {
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('✅ Token refresh successful!');
    console.log('Response:', JSON.stringify(tokenResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Token refresh failed');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Response Headers:', error.response?.headers);
    console.log('Response Data:', error.response?.data);
    
    if (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('<html>')) {
      console.log('\n⚠️ HTML response detected - this suggests the API endpoint might be incorrect or authentication is failing');
    }
  }
  console.log('');
  
  // Test with different content type
  console.log('3️⃣ Testing with application/x-www-form-urlencoded:');
  try {
    const params = new URLSearchParams();
    params.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN);
    params.append('client_id', process.env.ZOHO_CLIENT_ID);
    params.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');
    
    const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('✅ Token refresh with form data successful!');
    console.log('Response:', JSON.stringify(tokenResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Token refresh with form data failed');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Response Data:', error.response?.data);
  }
  console.log('');
  
  // Test organization access
  console.log('4️⃣ Testing Organization Access:');
  try {
    // First get a fresh token
    const params = new URLSearchParams();
    params.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN);
    params.append('client_id', process.env.ZOHO_CLIENT_ID);
    params.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');
    
    const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Got access token');
    
    // Test organization access
    const orgResponse = await axios.get(`https://books.zoho.com/api/v3/organizations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Organization access successful!');
    console.log('Organizations:', JSON.stringify(orgResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Organization access failed');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Response Data:', error.response?.data);
  }
}

debugZohoAuth().catch(console.error); 