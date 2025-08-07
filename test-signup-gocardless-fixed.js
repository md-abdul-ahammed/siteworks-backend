const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api';

async function testSignupWithGoCardlessFixed() {
  console.log('🧪 Testing Signup with GoCardless Integration (Fixed)...\n');

  try {
    // Test signup with USA bank details (working)
    console.log('📝 Testing signup with USA bank details...');
    
    const signupData = {
      email: `test-signup-fixed-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'Test Company',
      countryOfResidence: 'US',
      address: {
        line1: '123 Main Street',
        line2: 'Suite 100',
        city: 'New York',
        postcode: '10001',
        state: 'NY'
      },
      accountHolderName: 'John Doe',
      bankCode: '021000021',
      accountNumber: '1234567890',
      accountType: 'checking',
      preferredCurrency: 'USD'
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

    console.log('\n🎉 Signup with GoCardless test passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSignupWithGoCardlessFixed(); 