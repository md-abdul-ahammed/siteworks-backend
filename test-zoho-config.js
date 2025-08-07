require('dotenv').config();

console.log('🔍 Checking Zoho Configuration...\n');

console.log('Environment Variables:');
console.log('- ZOHO_CLIENT_ID:', process.env.ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('- ZOHO_CLIENT_SECRET:', process.env.ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('- ZOHO_REFRESH_TOKEN:', process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
console.log('- ZOHO_ORGANIZATION_ID:', process.env.ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing');

if (process.env.ZOHO_REFRESH_TOKEN) {
  console.log('\nRefresh Token (first 20 chars):', process.env.ZOHO_REFRESH_TOKEN.substring(0, 20) + '...');
}

console.log('\nTesting direct token request...');

const axios = require('axios');

async function testDirectTokenRequest() {
  try {
    const params = new URLSearchParams();
    params.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN);
    params.append('client_id', process.env.ZOHO_CLIENT_ID);
    params.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');

    console.log('Requesting token with:');
    console.log('- Refresh Token:', process.env.ZOHO_REFRESH_TOKEN ? 'Present' : 'Missing');
    console.log('- Client ID:', process.env.ZOHO_CLIENT_ID ? 'Present' : 'Missing');
    console.log('- Client Secret:', process.env.ZOHO_CLIENT_SECRET ? 'Present' : 'Missing');

    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ Token request successful!');
    console.log('Access Token:', response.data.access_token.substring(0, 20) + '...');
    console.log('Expires In:', response.data.expires_in, 'seconds');
    
    return response.data.access_token;
  } catch (error) {
    console.log('❌ Token request failed:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.log('Full Error Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
}

testDirectTokenRequest(); 