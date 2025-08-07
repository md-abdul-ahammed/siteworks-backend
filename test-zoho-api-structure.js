require('dotenv').config();
const axios = require('axios');

async function testZohoAPIStructure() {
  console.log('🔍 Testing Zoho API Structure...\n');
  
  try {
    // First get access token
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
    
    // Test 1: Check if we can list existing contacts
    console.log('\n1️⃣ Testing contact list...');
    try {
      const contactsResponse = await axios.get('https://www.zohoapis.com/books/v3/contacts', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Contact list successful');
      console.log('Contacts found:', contactsResponse.data.contacts?.length || 0);
      
      if (contactsResponse.data.contacts?.length > 0) {
        console.log('Sample contact:', JSON.stringify(contactsResponse.data.contacts[0], null, 2));
      }
      
    } catch (error) {
      console.log('❌ Contact list failed:', error.response?.data?.message || error.message);
    }
    
    // Test 2: Try creating a contact with different field names
    console.log('\n2️⃣ Testing contact creation with different field names...');
    
    const testData = {
      organization_id: process.env.ZOHO_ORGANIZATION_ID,
      contact_name: 'Test Customer', // Try contact_name instead of name
      email: 'test@example.com',
      phone: '+1234567890'
    };
    
    try {
      const createResponse = await axios.post('https://www.zohoapis.com/books/v3/contacts', testData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Contact created with contact_name field');
      console.log('Response:', JSON.stringify(createResponse.data, null, 2));
      
    } catch (error) {
      console.log('❌ Failed with contact_name:', error.response?.data?.message || error.message);
      
      // Test 3: Try with name field but different structure
      console.log('\n3️⃣ Testing with name field...');
      const testData2 = {
        organization_id: process.env.ZOHO_ORGANIZATION_ID,
        name: 'Test Customer',
        email: 'test2@example.com'
      };
      
      try {
        const createResponse2 = await axios.post('https://www.zohoapis.com/books/v3/contacts', testData2, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Contact created with name field');
        console.log('Response:', JSON.stringify(createResponse2.data, null, 2));
        
      } catch (error2) {
        console.log('❌ Failed with name field:', error2.response?.data?.message || error2.message);
        
        // Test 4: Check Zoho API documentation format
        console.log('\n4️⃣ Testing with minimal required fields...');
        const testData3 = {
          organization_id: process.env.ZOHO_ORGANIZATION_ID,
          name: 'Customer',
          email: 'test3@example.com'
        };
        
        try {
          const createResponse3 = await axios.post('https://www.zohoapis.com/books/v3/contacts', testData3, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Contact created with minimal fields');
          console.log('Response:', JSON.stringify(createResponse3.data, null, 2));
          
        } catch (error3) {
          console.log('❌ Failed with minimal fields:', error3.response?.data?.message || error3.message);
          console.log('Full error response:', JSON.stringify(error3.response?.data, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testZohoAPIStructure().catch(console.error); 