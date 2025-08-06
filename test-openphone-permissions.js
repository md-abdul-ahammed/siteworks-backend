require('dotenv').config();
const axios = require('axios');

async function testOpenPhonePermissions() {
  console.log('=== OpenPhone API Permissions Diagnostic ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  console.log('🔑 API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Not found');
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Test different endpoints to understand permission scope
  const permissionTests = [
    {
      name: 'Read Contacts',
      method: 'GET',
      endpoint: '/contacts',
      requiredScope: 'contacts:read',
      description: 'Basic read access to contacts'
    },
    {
      name: 'Create Contact',
      method: 'POST',
      endpoint: '/contacts',
      requiredScope: 'contacts:write',
      description: 'Permission to create new contacts',
      data: {
        source: "public-api",
        defaultFields: {
          firstName: "Test",
          lastName: "Permission"
        }
      }
    },
    {
      name: 'Read User Info',
      method: 'GET',
      endpoint: '/user',
      requiredScope: 'user:read',
      description: 'Basic user information access'
    },
    {
      name: 'Read Numbers',
      method: 'GET',
      endpoint: '/phone-numbers',
      requiredScope: 'numbers:read',
      description: 'Access to phone numbers'
    },
    {
      name: 'Read Messages',
      method: 'GET',
      endpoint: '/messages',
      requiredScope: 'messages:read',
      description: 'Access to messages'
    }
  ];
  
  console.log('\n🔍 Testing API Permissions...\n');
  
  const results = [];
  
  for (const test of permissionTests) {
    try {
      console.log(`Testing: ${test.name}`);
      
      const config = {
        method: test.method,
        url: `${baseUrl}${test.endpoint}`,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      };
      
      if (test.data) {
        config.data = test.data;
      }
      
      const response = await axios(config);
      
      console.log(`✅ ${test.name} - WORKS`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Required Scope: ${test.requiredScope}`);
      
      results.push({
        test: test.name,
        status: 'SUCCESS',
        scope: test.requiredScope,
        httpStatus: response.status
      });
      
      // Clean up created contact
      if (test.method === 'POST' && test.endpoint === '/contacts' && response.data?.data?.id) {
        try {
          await axios.delete(`${baseUrl}/contacts/${response.data.data.id}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`   ✅ Test contact cleaned up`);
        } catch (cleanupError) {
          console.log(`   ⚠️ Could not clean up test contact`);
        }
      }
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Status: ${status}`);
      console.log(`   Error: ${message}`);
      console.log(`   Required Scope: ${test.requiredScope}`);
      
      results.push({
        test: test.name,
        status: 'FAILED',
        scope: test.requiredScope,
        httpStatus: status,
        error: message
      });
      
      if (status === 401) {
        console.log(`   🔍 Missing permission: ${test.requiredScope}`);
      } else if (status === 403) {
        console.log(`   🔍 Access forbidden - account level restriction`);
      } else if (status === 404) {
        console.log(`   🔍 Endpoint not found - might not be available`);
      }
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Summary
  console.log('=== PERMISSION ANALYSIS ===\n');
  
  const successful = results.filter(r => r.status === 'SUCCESS');
  const failed = results.filter(r => r.status === 'FAILED');
  
  console.log(`✅ Working permissions: ${successful.length}`);
  successful.forEach(r => console.log(`   - ${r.scope} (${r.test})`));
  
  console.log(`\n❌ Missing permissions: ${failed.length}`);
  failed.forEach(r => console.log(`   - ${r.scope} (${r.test}) - ${r.error}`));
  
  console.log('\n💡 RECOMMENDATIONS:');
  
  if (failed.length === 0) {
    console.log('🎉 All permissions are working! Your API key is properly configured.');
  } else {
    console.log('1. Contact OpenPhone support to enable missing permissions');
    console.log('2. Check if your account plan includes API access');
    console.log('3. Generate a new API key with explicit permissions');
    console.log('4. Verify your account is fully activated for API access');
    
    const missingScopes = failed.map(r => r.scope).join(', ');
    console.log(`\n📝 Tell OpenPhone support you need these scopes: ${missingScopes}`);
  }
}

testOpenPhonePermissions().catch(console.error);