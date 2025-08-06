const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test data for Canadian customer
const testCustomer = {
  email: `test-ca-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  firstName: 'John',
  lastName: 'Doe',
  companyName: 'Test Corp',
  phone: '+1234567890',
  countryOfResidence: 'CA',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 100',
  city: 'Toronto',
  postcode: 'M5V 3A8',
  state: 'ON',
  accountHolderName: 'John Doe',
  bankCode: '000200010', // Royal Bank of Canada routing number
  accountNumber: '1234567890',
  accountType: 'checking',
  preferredCurrency: 'CAD'
};

async function testCanadaRegistration() {
  console.log('🧪 Testing Canadian Customer Registration with GoCardless Integration');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Register Canadian customer with bank details
    console.log('\n1️⃣ Testing Canadian customer registration with bank details...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testCustomer);
    
    if (registerResponse.data.success) {
      console.log('✅ Registration successful');
      console.log('📧 Email:', registerResponse.data.customer.email);
      console.log('🆔 Customer ID:', registerResponse.data.customer.id);
      console.log('💳 GoCardless Customer ID:', registerResponse.data.customer.goCardlessCustomerId);
      console.log('🏦 GoCardless Bank Account ID:', registerResponse.data.customer.goCardlessBankAccountId);
      console.log('📋 GoCardless Mandate ID:', registerResponse.data.customer.goCardlessMandateId);
      console.log('📊 Mandate Status:', registerResponse.data.customer.mandateStatus);
      
      // Test 2: Login to get access token
      console.log('\n2️⃣ Testing login...');
      const loginResponse = await axios.post(`${BASE_URL}/auth/signin`, {
        email: testCustomer.email,
        password: testCustomer.password
      });
      
      if (loginResponse.data.success) {
        const accessToken = loginResponse.data.tokens.accessToken;
        console.log('✅ Login successful');
        console.log('🔑 Access Token:', accessToken.substring(0, 20) + '...');
        
        // Test 3: Check GoCardless status
        console.log('\n3️⃣ Testing GoCardless status check...');
        const statusResponse = await axios.get(`${BASE_URL}/auth/gocardless-status`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (statusResponse.data.success) {
          console.log('✅ GoCardless status check successful');
          console.log('📊 Status Data:', JSON.stringify(statusResponse.data.data, null, 2));
        } else {
          console.log('❌ GoCardless status check failed:', statusResponse.data);
        }
        
      } else {
        console.log('❌ Login failed:', loginResponse.data);
      }
      
    } else {
      console.log('❌ Registration failed:', registerResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

async function testCanadaSetupGoCardless() {
  console.log('\n🧪 Testing Canadian Customer GoCardless Setup (Post-Registration)');
  console.log('=' .repeat(60));
  
  try {
    // Create a customer without bank details first
    const customerWithoutBank = {
      ...testCustomer,
      email: `test-ca-setup-${Date.now()}@example.com`,
      accountHolderName: undefined,
      bankCode: undefined,
      accountNumber: undefined,
      accountType: undefined
    };
    
    console.log('\n1️⃣ Creating customer without bank details...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, customerWithoutBank);
    
    if (registerResponse.data.success) {
      console.log('✅ Customer created without bank details');
      
      // Login to get access token
      const loginResponse = await axios.post(`${BASE_URL}/auth/signin`, {
        email: customerWithoutBank.email,
        password: customerWithoutBank.password
      });
      
      if (loginResponse.data.success) {
        const accessToken = loginResponse.data.tokens.accessToken;
        console.log('✅ Login successful');
        
        // Setup GoCardless with Canadian bank details
        console.log('\n2️⃣ Setting up GoCardless with Canadian bank details...');
        const setupResponse = await axios.post(`${BASE_URL}/auth/setup-gocardless`, {
          accountHolderName: 'John Doe',
          bankCode: '000200010', // Royal Bank of Canada routing number
          accountNumber: '1234567890',
          accountType: 'checking'
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (setupResponse.data.success) {
          console.log('✅ GoCardless setup successful');
          console.log('📊 Setup Data:', JSON.stringify(setupResponse.data.data, null, 2));
        } else {
          console.log('❌ GoCardless setup failed:', setupResponse.data);
        }
        
      } else {
        console.log('❌ Login failed:', loginResponse.data);
      }
      
    } else {
      console.log('❌ Customer creation failed:', registerResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

async function testValidationErrors() {
  console.log('\n🧪 Testing Validation Errors for Canadian Customers');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Missing accountType
    console.log('\n1️⃣ Testing missing accountType...');
    const testData1 = { ...testCustomer, accountType: undefined };
    try {
      await axios.post(`${BASE_URL}/auth/register`, testData1);
      console.log('❌ Should have failed with missing accountType');
    } catch (error) {
      if (error.response?.data?.error === 'Validation failed') {
        console.log('✅ Correctly rejected missing accountType');
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }
    
    // Test 2: Invalid accountType
    console.log('\n2️⃣ Testing invalid accountType...');
    const testData2 = { ...testCustomer, accountType: 'invalid' };
    try {
      await axios.post(`${BASE_URL}/auth/register`, testData2);
      console.log('❌ Should have failed with invalid accountType');
    } catch (error) {
      if (error.response?.data?.error === 'Validation failed') {
        console.log('✅ Correctly rejected invalid accountType');
      } else {
        console.log('❌ Unexpected error:', error.response?.data);
      }
    }
    
    // Test 3: Missing bank details but providing accountType
    console.log('\n3️⃣ Testing missing bank details but providing accountType...');
    const testData3 = { ...testCustomer, accountHolderName: undefined, bankCode: undefined, accountNumber: undefined };
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, testData3);
      if (response.data.success) {
        console.log('✅ Correctly handled missing bank details');
      } else {
        console.log('❌ Unexpected response:', response.data);
      }
    } catch (error) {
      console.log('❌ Unexpected error:', error.response?.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting GoCardless Canada Integration Tests');
  console.log('=' .repeat(60));
  
  await testCanadaRegistration();
  await testCanadaSetupGoCardless();
  await testValidationErrors();
  
  console.log('\n🎉 All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testCanadaRegistration,
  testCanadaSetupGoCardless,
  testValidationErrors,
  runAllTests
}; 