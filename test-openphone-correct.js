require('dotenv').config();
const axios = require('axios');

async function testOpenPhoneCorrectFormat() {
  console.log('=== Testing OpenPhone API with Correct Format ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  console.log('API Key:', apiKey ? 'Found' : 'Not found');
  
  // Test 1: Create contact with correct format
  console.log('\n1. Testing POST /contacts with correct format...');
  try {
    const payload = {
      source: "public-api",
      defaultFields: {
        firstName: "John",
        lastName: "Doe",
        company: "Test Company"
      }
    };

    // Add email
    payload.defaultFields.emails = [{
      name: "primary",
      value: "john.doe@example.com"
    }];

    // Add phone
    payload.defaultFields.phoneNumbers = [{
      name: "primary",
      value: "+1234567890"
    }];

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(`${baseUrl}/contacts`, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      console.log('\n2. Cleaning up test contact...');
      try {
        await axios.delete(`${baseUrl}/contacts/${response.data.data.id}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
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
  }

  // Test 2: Get contacts
  console.log('\n3. Testing GET /contacts...');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ GET /contacts successful');
    console.log('Contacts count:', response.data?.data?.length || 0);

  } catch (error) {
    console.log('❌ GET /contacts failed');
    console.log('Error:', error.response?.data?.message || error.message);
  }

  console.log('\n=== Test Complete ===');
}

testOpenPhoneCorrectFormat().catch(console.error); 