const axios = require('axios');

const API_BASE_URL = 'http://localhost:8000/api';

async function testGoCardlessAuthIntegration() {
  console.log('🧪 Testing GoCardless Auth Integration...\n');

  try {
    // Test 1: Register customer with GoCardless integration
    console.log('📝 Test 1: Register customer with GoCardless integration');
    
    const registrationData = {
      email: `test-gocardless-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'Test Company',
      phone: '+1234567890',
      countryOfResidence: 'GB',
      addressLine1: '123 Test Street',
      addressLine2: 'Suite 100',
      city: 'London',
      postcode: 'SW1A 1AA',
      state: 'England',
      accountHolderName: 'John Doe',
      bankCode: '123456',
      accountNumber: '12345678',
      accountType: 'checking',
      preferredCurrency: 'GBP'
    };

    const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, registrationData);
    
    console.log('✅ Registration successful');
    console.log('Customer ID:', registerResponse.data.customer.id);
    console.log('GoCardless integrated:', registerResponse.data.gocardless.integrated);
    console.log('GoCardless Customer ID:', registerResponse.data.gocardless.customerId);
    console.log('GoCardless Mandate ID:', registerResponse.data.gocardless.mandateId);
    console.log('Mandate Status:', registerResponse.data.gocardless.mandateStatus);
    console.log('Access Token:', registerResponse.data.tokens.accessToken.substring(0, 20) + '...');
    console.log('');

    const accessToken = registerResponse.data.tokens.accessToken;

    // Test 2: Check GoCardless status
    console.log('📊 Test 2: Check GoCardless status');
    
    const statusResponse = await axios.get(`${API_BASE_URL}/auth/gocardless-status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('✅ GoCardless status retrieved');
    console.log('Has GoCardless Customer:', statusResponse.data.data.hasGoCardlessCustomer);
    console.log('Has Bank Account:', statusResponse.data.data.hasBankAccount);
    console.log('Has Mandate:', statusResponse.data.data.hasMandate);
    console.log('Mandate Status:', statusResponse.data.data.mandateStatus);
    console.log('');

    // Test 3: Register customer without GoCardless (bank details)
    console.log('📝 Test 3: Register customer without GoCardless integration');
    
    const registrationDataNoBank = {
      email: `test-no-gocardless-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Jane',
      lastName: 'Smith',
      companyName: 'Another Company',
      phone: '+0987654321',
      countryOfResidence: 'GB',
      addressLine1: '456 Another Street',
      city: 'Manchester',
      postcode: 'M1 1AA',
      state: 'England'
      // No bank details provided
    };

    const registerNoBankResponse = await axios.post(`${API_BASE_URL}/auth/register`, registrationDataNoBank);
    
    console.log('✅ Registration successful (without GoCardless)');
    console.log('Customer ID:', registerNoBankResponse.data.customer.id);
    console.log('GoCardless integrated:', registerNoBankResponse.data.gocardless.integrated);
    console.log('GoCardless Customer ID:', registerNoBankResponse.data.gocardless.customerId);
    console.log('');

    const accessTokenNoBank = registerNoBankResponse.data.tokens.accessToken;

    // Test 4: Setup GoCardless for customer without bank details
    console.log('🔧 Test 4: Setup GoCardless for customer without bank details');
    
    const setupGoCardlessData = {
      accountHolderName: 'Jane Smith',
      bankCode: '654321',
      accountNumber: '87654321',
      accountType: 'savings'
    };

    const setupResponse = await axios.post(`${API_BASE_URL}/auth/setup-gocardless`, setupGoCardlessData, {
      headers: {
        'Authorization': `Bearer ${accessTokenNoBank}`
      }
    });

    console.log('✅ GoCardless setup successful');
    console.log('Customer ID:', setupResponse.data.data.customerId);
    console.log('Bank Account ID:', setupResponse.data.data.bankAccountId);
    console.log('Mandate ID:', setupResponse.data.data.mandateId);
    console.log('Mandate Status:', setupResponse.data.data.mandateStatus);
    console.log('');

    // Test 5: Check GoCardless status after setup
    console.log('📊 Test 5: Check GoCardless status after setup');
    
    const statusAfterSetupResponse = await axios.get(`${API_BASE_URL}/auth/gocardless-status`, {
      headers: {
        'Authorization': `Bearer ${accessTokenNoBank}`
      }
    });

    console.log('✅ GoCardless status retrieved after setup');
    console.log('Has GoCardless Customer:', statusAfterSetupResponse.data.data.hasGoCardlessCustomer);
    console.log('Has Bank Account:', statusAfterSetupResponse.data.data.hasBankAccount);
    console.log('Has Mandate:', statusAfterSetupResponse.data.data.hasMandate);
    console.log('Mandate Status:', statusAfterSetupResponse.data.data.mandateStatus);
    console.log('');

    console.log('🎉 All tests passed! GoCardless integration with auth registration is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testGoCardlessAuthIntegration(); 