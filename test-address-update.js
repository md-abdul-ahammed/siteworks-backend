require('dotenv').config();
const axios = require('axios');

async function testAddressUpdate() {
  console.log('Testing address update functionality...\n');

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  
  // Test data
  const testCustomer = {
    email: 'test-address@example.com',
    password: 'TestPass123!',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Test Company',
    phone: '+12345678901', // US format with country code
    countryOfResidence: 'US',
    address: {
      line1: '123 Test Street',
      line2: 'Apt 4B',
      city: 'Test City',
      postcode: '12345',
      state: 'CA'
    }
  };

  const updatedAddress = {
    line1: '456 Updated Street',
    line2: 'Suite 10',
    city: 'Updated City',
    postcode: '54321',
    state: 'NY'
  };

  try {
    // Step 1: Register a test customer
    console.log('🔄 Step 1: Registering test customer...');
    const registerResponse = await axios.post(`${baseUrl}/api/customers/register`, testCustomer);
    
    if (registerResponse.data.success) {
      console.log('✅ Customer registered successfully');
      const { accessToken } = registerResponse.data.tokens;
      
      // Step 2: Test basic profile update (should work)
      console.log('\n🔄 Step 2: Testing basic profile update...');
      const basicUpdateResponse = await axios.put(`${baseUrl}/api/customers/profile`, {
        firstName: 'Jane',
        lastName: 'Smith',
        companyName: 'Updated Company',
        phone: '+19876543210'
      }, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (basicUpdateResponse.data.success) {
        console.log('✅ Basic profile update successful');
        console.log('Updated customer:', basicUpdateResponse.data.customer);
      } else {
        console.log('❌ Basic profile update failed');
      }

      // Step 3: Test address update
      console.log('\n🔄 Step 3: Testing address update...');
      const addressUpdateResponse = await axios.put(`${baseUrl}/api/customers/profile`, {
        address: updatedAddress
      }, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (addressUpdateResponse.data.success) {
        console.log('✅ Address update successful');
        console.log('Updated customer address:');
        console.log('  Line 1:', addressUpdateResponse.data.customer.addressLine1);
        console.log('  Line 2:', addressUpdateResponse.data.customer.addressLine2);
        console.log('  City:', addressUpdateResponse.data.customer.city);
        console.log('  Postcode:', addressUpdateResponse.data.customer.postcode);
        console.log('  State:', addressUpdateResponse.data.customer.state);
      } else {
        console.log('❌ Address update failed');
        console.log('Error:', addressUpdateResponse.data);
      }

      // Step 4: Test partial address update
      console.log('\n🔄 Step 4: Testing partial address update...');
      const partialAddressUpdateResponse = await axios.put(`${baseUrl}/api/customers/profile`, {
        address: {
          line1: '789 Partial Update Street',
          city: 'Partial City'
          // Only updating line1 and city, leaving others unchanged
        }
      }, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (partialAddressUpdateResponse.data.success) {
        console.log('✅ Partial address update successful');
        console.log('Updated customer address:');
        console.log('  Line 1:', partialAddressUpdateResponse.data.customer.addressLine1);
        console.log('  Line 2:', partialAddressUpdateResponse.data.customer.addressLine2);
        console.log('  City:', partialAddressUpdateResponse.data.customer.city);
        console.log('  Postcode:', partialAddressUpdateResponse.data.customer.postcode);
        console.log('  State:', partialAddressUpdateResponse.data.customer.state);
      } else {
        console.log('❌ Partial address update failed');
        console.log('Error:', partialAddressUpdateResponse.data);
      }

      // Step 5: Test clearing address line 2
      console.log('\n🔄 Step 5: Testing clearing address line 2...');
      const clearAddressLine2Response = await axios.put(`${baseUrl}/api/customers/profile`, {
        address: {
          line2: '' // Setting to empty string to clear it
        }
      }, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (clearAddressLine2Response.data.success) {
        console.log('✅ Address line 2 cleared successfully');
        console.log('Updated customer address:');
        console.log('  Line 1:', clearAddressLine2Response.data.customer.addressLine1);
        console.log('  Line 2:', clearAddressLine2Response.data.customer.addressLine2);
        console.log('  City:', clearAddressLine2Response.data.customer.city);
      } else {
        console.log('❌ Clearing address line 2 failed');
        console.log('Error:', clearAddressLine2Response.data);
      }

      console.log('\n✅ Address update test completed successfully!');

    } else {
      console.log('❌ Customer registration failed');
      console.log('Error:', registerResponse.data);
    }

  } catch (error) {
    console.error('❌ Error during address update test:', error.response?.data || error.message);
  }
}

testAddressUpdate().catch(console.error); 