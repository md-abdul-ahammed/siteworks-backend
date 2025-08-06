const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test cases for bank validation
const testCases = [
  {
    name: 'Valid US Bank Details',
    data: {
      accountHolderName: 'John Doe',
      bankCode: '021000021',
      accountNumber: '1234567890',
      accountType: 'checking',
      countryCode: 'US'
    },
    expectedValid: true
  },
  {
    name: 'Invalid US Bank Code (too short)',
    data: {
      accountHolderName: 'John Doe',
      bankCode: '12345',
      accountNumber: '1234567890',
      accountType: 'checking',
      countryCode: 'US'
    },
    expectedValid: false
  },
  {
    name: 'Valid Canadian Bank Details',
    data: {
      accountHolderName: 'Jane Smith',
      bankCode: '021000021',
      accountNumber: '1234567890',
      accountType: 'savings',
      countryCode: 'CA'
    },
    expectedValid: true
  },
  {
    name: 'Valid UK Bank Details',
    data: {
      accountHolderName: 'Bob Wilson',
      bankCode: '123456',
      accountNumber: '12345678',
      accountType: 'checking',
      countryCode: 'GB'
    },
    expectedValid: true
  },
  {
    name: 'Invalid UK Account Number (wrong length)',
    data: {
      accountHolderName: 'Bob Wilson',
      bankCode: '123456',
      accountNumber: '1234567',
      accountType: 'checking',
      countryCode: 'GB'
    },
    expectedValid: false
  }
];

async function testBankValidation() {
  console.log('🧪 Testing Bank Validation API...\n');

  for (const testCase of testCases) {
    try {
      console.log(`📋 Testing: ${testCase.name}`);
      console.log(`📤 Sending data:`, testCase.data);
      
      const response = await axios.post(`${BASE_URL}/api/auth/validate-bank-details`, testCase.data, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Response:`, {
        isValid: response.data.isValid,
        errors: response.data.errors,
        warnings: response.data.warnings,
        suggestions: response.data.suggestions
      });

      if (response.data.isValid === testCase.expectedValid) {
        console.log(`✅ Test PASSED - Expected: ${testCase.expectedValid}, Got: ${response.data.isValid}\n`);
      } else {
        console.log(`❌ Test FAILED - Expected: ${testCase.expectedValid}, Got: ${response.data.isValid}\n`);
      }

    } catch (error) {
      console.log(`❌ Test FAILED - Error:`, error.response?.data || error.message);
      console.log('');
    }
  }

  console.log('🏁 Bank validation tests completed!');
}

// Test registration with bank details
async function testRegistrationWithBankDetails() {
  console.log('\n🧪 Testing Registration with Bank Details...\n');

  const testCustomer = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    companyName: 'Test Company',
    phone: '+1234567890',
    countryOfResidence: 'US',
    addressLine1: '123 Test St',
    addressLine2: 'Apt 1',
    city: 'Test City',
    postcode: '12345',
    state: 'CA',
    // Bank details
    accountHolderName: 'Test User',
    bankCode: '021000021',
    accountNumber: '1234567890',
    accountType: 'checking',
    preferredCurrency: 'USD'
  };

  try {
    console.log('📤 Registering customer with bank details...');
    
    const response = await axios.post(`${BASE_URL}/api/auth/register`, testCustomer, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Registration successful!');
    console.log('📊 Response:', {
      success: response.data.success,
      customerId: response.data.customer?.id,
      gocardless: response.data.gocardless
    });

  } catch (error) {
    console.log('❌ Registration failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  try {
    await testBankValidation();
    await testRegistrationWithBankDetails();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

runTests(); 