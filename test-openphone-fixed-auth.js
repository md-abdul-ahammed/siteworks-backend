require('dotenv').config();
const axios = require('axios');

async function testOpenPhoneFixedAuth() {
  console.log('=== Testing OpenPhone API with CORRECT Authentication ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  console.log('🔑 API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Not found');
  console.log('📚 Using OpenPhone documentation: https://www.openphone.com/docs/mdx/api-reference/authentication');
  console.log('✅ Correct Auth Method: Authorization: YOUR_API_KEY (NOT Bearer)');
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Test 1: Get contacts with correct authentication
  console.log('\n1. Testing GET /contacts with correct authentication...');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': apiKey,  // CORRECT: Direct API key, no "Bearer"
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ GET /contacts successful!');
    console.log('Response status:', response.status);
    console.log('Contacts count:', response.data?.data?.length || 0);
    
    if (response.data?.data?.length > 0) {
      console.log('Sample contact:', {
        id: response.data.data[0].id,
        name: response.data.data[0].defaultFields?.firstName + ' ' + response.data.data[0].defaultFields?.lastName
      });
    }
    
  } catch (error) {
    console.log('❌ GET /contacts failed');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('🔍 Still unauthorized - API key may need activation or permissions');
    }
  }
  
  // Test 2: Create contact with correct format and authentication
  console.log('\n2. Testing POST /contacts with correct authentication...');
  try {
    const payload = {
      source: "public-api",
      defaultFields: {
        firstName: "Test",
        lastName: "User",
        company: "SiteWorks Integration Test"
      }
    };

    // Add email
    payload.defaultFields.emails = [{
      name: "primary",
      value: "test.integration@siteworks.com"
    }];

    // Add phone
    payload.defaultFields.phoneNumbers = [{
      name: "primary", 
      value: "+1234567890"
    }];

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(`${baseUrl}/contacts`, payload, {
      headers: {
        'Authorization': apiKey,  // CORRECT: Direct API key, no "Bearer"
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Contact created successfully!');
    console.log('Response status:', response.status);
    console.log('Contact ID:', response.data?.data?.id);
    console.log('Contact details:', response.data?.data?.defaultFields);

    // Clean up - delete the test contact
    if (response.data?.data?.id) {
      console.log('\n3. Cleaning up test contact...');
      try {
        await axios.delete(`${baseUrl}/contacts/${response.data.data.id}`, {
          headers: {
            'Authorization': apiKey,  // CORRECT: Direct API key, no "Bearer"
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Test contact cleaned up');
      } catch (deleteError) {
        console.log('⚠️ Could not clean up test contact:', deleteError.response?.data?.message || deleteError.message);
      }
    }

  } catch (error) {
    console.log('❌ Contact creation failed');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.log('🔍 Still unauthorized - check if API key needs activation');
    }
  }
  
  console.log('\n=== Test Complete ===');
  console.log('\n📖 Reference: OpenPhone API Authentication');
  console.log('https://www.openphone.com/docs/mdx/api-reference/authentication');
}

testOpenPhoneFixedAuth().catch(console.error);