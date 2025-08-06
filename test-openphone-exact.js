require('dotenv').config();
const axios = require('axios');

// Create axios instance like in your example
const api = axios.create({
  baseURL: 'https://api.openphone.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function testOpenPhoneExact() {
  console.log('=== Testing OpenPhone API with Exact Structure ===');
  
  console.log('API Key:', process.env.OPENPHONE_API_KEY ? 'Found' : 'Not found');
  
  try {
    // Test 1: Get contacts (like your getContacts function)
    console.log('\n1. Testing GET /contacts...');
    const contactsResponse = await api.get('/contacts');
    console.log('✅ GET /contacts successful');
    console.log('Response:', contactsResponse.data);
    
  } catch (error) {
    console.log('❌ GET /contacts failed');
    console.log('Error:', error.response?.data || error.message);
  }
  
  try {
    // Test 2: Create contact (like your createContact function)
    console.log('\n2. Testing POST /contacts...');
    const createResponse = await api.post('/contacts', {
      name: 'Test User',
      phoneNumber: '+1234567890'
    });
    console.log('✅ POST /contacts successful');
    console.log('Created contact:', createResponse.data);
    
    // Clean up - delete the test contact
    if (createResponse.data.id) {
      console.log('\n3. Cleaning up test contact...');
      await api.delete(`/contacts/${createResponse.data.id}`);
      console.log('✅ Test contact cleaned up');
    }
    
  } catch (error) {
    console.log('❌ POST /contacts failed');
    console.log('Error:', error.response?.data || error.message);
  }
  
  try {
    // Test 3: Send message (like your sendMessage function)
    console.log('\n4. Testing POST /messages...');
    const messageResponse = await api.post('/messages', {
      to: '+1234567890',
      text: 'Test message from SiteWorks integration'
    });
    console.log('✅ POST /messages successful');
    console.log('Message sent:', messageResponse.data);
    
  } catch (error) {
    console.log('❌ POST /messages failed');
    console.log('Error:', error.response?.data || error.message);
  }
  
  try {
    // Test 4: Get call logs (like your getCallLogs function)
    console.log('\n5. Testing GET /calls...');
    const callsResponse = await api.get('/calls');
    console.log('✅ GET /calls successful');
    console.log('Call logs:', callsResponse.data);
    
  } catch (error) {
    console.log('❌ GET /calls failed');
    console.log('Error:', error.response?.data || error.message);
  }
}

testOpenPhoneExact().catch(console.error); 