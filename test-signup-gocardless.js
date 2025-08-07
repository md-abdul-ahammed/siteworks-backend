const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api';

async function testSignupWithGoCardless() {
  console.log('🧪 Testing Signup with GoCardless Integration...\n');

  try {
    // Test signup with bank details
    console.log('📝 Testing signup with bank details...');
    
    const signupData = {
      email: `test-signup-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company',
      // phone: '+44123456789', // Optional field
      countryOfResidence: 'GB',
      address: {
        line1: '123 Test Street',
        line2: 'Suite 100',
        city: 'London',
        postcode: 'SW1A 1AA',
        state: 'England'
      },
      accountHolderName: 'Test User',
      bankCode: '123456',
      accountNumber: '12345678',
      accountType: 'checking',
      preferredCurrency: 'GBP'
    };

    console.log('Sending signup request...');
    const response = await axios.post(`${API_BASE_URL}/customers/register`, signupData);
    
    console.log('✅ Signup successful');
    console.log('Customer ID:', response.data.customer.id);
    console.log('Email:', response.data.customer.email);
    console.log('GoCardless Customer ID:', response.data.customer.goCardlessCustomerId);
    console.log('GoCardless Bank Account ID:', response.data.customer.goCardlessBankAccountId);
    console.log('GoCardless Mandate ID:', response.data.customer.goCardlessMandateId);
    console.log('Mandate Status:', response.data.customer.mandateStatus);
    console.log('Access Token:', response.data.tokens.accessToken.substring(0, 20) + '...');
    
    // Check if GoCardless integration was successful
    if (response.data.customer.goCardlessCustomerId) {
      console.log('✅ GoCardless Customer created successfully');
    } else {
      console.log('❌ GoCardless Customer creation failed');
    }
    
    if (response.data.customer.goCardlessMandateId) {
      console.log('✅ GoCardless Mandate created successfully');
    } else {
      console.log('❌ GoCardless Mandate creation failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSignupWithGoCardless(); 