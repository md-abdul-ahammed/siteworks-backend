require('dotenv').config();
const OpenPhoneService = require('./services/openphone');

async function testOpenPhoneWithEnv() {
  console.log('=== Testing OpenPhone Integration with Environment Variables ===');
  
  // Check if environment variable is loaded
  console.log('Environment variable check:');
  console.log('OPENPHONE_API_KEY exists:', !!process.env.OPENPHONE_API_KEY);
  console.log('API Key length:', process.env.OPENPHONE_API_KEY ? process.env.OPENPHONE_API_KEY.length : 0);
  
  const openPhoneService = new OpenPhoneService();
  
  // Test 1: Check if service is configured
  console.log('\n1. Checking OpenPhone service configuration...');
  const isConfigured = openPhoneService.isConfigured();
  console.log('OpenPhone API configured:', isConfigured);
  
  if (!isConfigured) {
    console.log('❌ OpenPhone API key not found. Please check your .env file.');
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
      
      // Clean up test contact
      console.log('\n3. Cleaning up test contact...');
      const deleted = await openPhoneService.deleteContact(createdContact.id);
      
      if (deleted) {
        console.log('✅ Test contact cleaned up successfully');
      } else {
        console.log('⚠️  Could not clean up test contact (this is okay for testing)');
      }
      
    } else {
      console.log('❌ Failed to create contact');
    }
    
  } catch (error) {
    console.error('❌ Error during OpenPhone integration test:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  }
  
  console.log('\n=== OpenPhone Integration Test Complete ===');
}

// Run the test
testOpenPhoneWithEnv().catch(console.error); 