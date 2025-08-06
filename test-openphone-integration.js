const OpenPhoneService = require('./services/openphone');

// Test OpenPhone integration
async function testOpenPhoneIntegration() {
  console.log('=== Testing OpenPhone Integration ===');
  
  const openPhoneService = new OpenPhoneService();
  
  // Test 1: Check if service is configured
  console.log('\n1. Checking OpenPhone service configuration...');
  const isConfigured = openPhoneService.isConfigured();
  console.log('OpenPhone API configured:', isConfigured);
  
  if (!isConfigured) {
    console.log('⚠️  OpenPhone API key not found. Set OPENPHONE_API_KEY environment variable to test full integration.');
    console.log('Integration will still work but contact creation will be skipped.');
    return;
  }
  
  // Test 2: Create a test contact
  console.log('\n2. Creating test contact...');
  const testContactData = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test.user@example.com',
    phone: '+1234567890',
    companyName: 'Test Company',
    notes: 'Test contact from SiteWorks integration'
  };
  
  try {
    const createdContact = await openPhoneService.createContact(testContactData);
    
    if (createdContact) {
      console.log('✅ Contact created successfully:', createdContact.id);
      console.log('Contact details:', {
        name: `${createdContact.firstName} ${createdContact.lastName}`,
        email: createdContact.email,
        phone: createdContact.phone,
        company: createdContact.company
      });
      
      // Test 3: Get contact by email
      console.log('\n3. Retrieving contact by email...');
      const retrievedContact = await openPhoneService.getContactByEmail(testContactData.email);
      
      if (retrievedContact) {
        console.log('✅ Contact retrieved successfully:', retrievedContact.id);
      } else {
        console.log('❌ Failed to retrieve contact');
      }
      
      // Test 4: Update contact
      console.log('\n4. Updating contact...');
      const updatedContactData = {
        ...testContactData,
        firstName: 'Updated',
        notes: 'Updated test contact from SiteWorks integration'
      };
      
      const updatedContact = await openPhoneService.updateContact(createdContact.id, updatedContactData);
      
      if (updatedContact) {
        console.log('✅ Contact updated successfully');
      } else {
        console.log('❌ Failed to update contact');
      }
      
      // Test 5: Delete contact (cleanup)
      console.log('\n5. Cleaning up test contact...');
      const deleted = await openPhoneService.deleteContact(createdContact.id);
      
      if (deleted) {
        console.log('✅ Contact deleted successfully');
      } else {
        console.log('❌ Failed to delete contact');
      }
      
    } else {
      console.log('❌ Failed to create contact');
    }
    
  } catch (error) {
    console.error('❌ Error during OpenPhone integration test:', error.message);
  }
  
  console.log('\n=== OpenPhone Integration Test Complete ===');
}

// Test registration flow simulation
async function testRegistrationFlow() {
  console.log('\n=== Testing Registration Flow with OpenPhone ===');
  
  const openPhoneService = new OpenPhoneService();
  
  // Simulate customer registration data
  const customerData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    companyName: 'Acme Corporation',
    addressLine1: '123 Main St',
    city: 'New York',
    postcode: '10001',
    countryOfResidence: 'US'
  };
  
  console.log('Simulating customer registration...');
  console.log('Customer data:', customerData);
  
  try {
    // Simulate OpenPhone contact creation during registration
    const contact = await openPhoneService.createContact({
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phone: customerData.phone,
      companyName: customerData.companyName,
      notes: `Customer from SiteWorks - Registration Test`
    });
    
    if (contact) {
      console.log('✅ OpenPhone contact created during registration simulation');
      console.log('Contact ID:', contact.id);
      
      // Clean up test contact
      await openPhoneService.deleteContact(contact.id);
      console.log('✅ Test contact cleaned up');
    } else {
      console.log('⚠️  OpenPhone contact creation skipped (API not configured)');
    }
    
  } catch (error) {
    console.error('❌ Error during registration flow test:', error.message);
  }
  
  console.log('=== Registration Flow Test Complete ===');
}

// Run tests
async function runTests() {
  try {
    await testOpenPhoneIntegration();
    await testRegistrationFlow();
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testOpenPhoneIntegration,
  testRegistrationFlow
}; 