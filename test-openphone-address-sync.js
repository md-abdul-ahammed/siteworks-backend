require('dotenv').config();
const OpenPhoneSyncService = require('./services/openphone-sync');

async function testOpenPhoneAddressSync() {
  console.log('Testing OpenPhone address sync functionality...\n');

  const openPhoneSyncService = new OpenPhoneSyncService();

  // Test customer data with address
  const customerDataWithAddress = {
    email: 'test-address-sync@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Test Company',
    phone: '+12345678901',
    openPhoneContactId: null,
    addressLine1: '123 Test Street',
    addressLine2: 'Apt 4B',
    city: 'Test City',
    postcode: '12345',
    state: 'CA'
  };

  const customerDataWithoutAddress = {
    email: 'test-address-sync@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Test Company',
    phone: '+12345678901',
    openPhoneContactId: null
  };

  console.log('OpenPhone API configured:', openPhoneSyncService.isConfigured());

  if (!openPhoneSyncService.isConfigured()) {
    console.log('❌ OpenPhone API key not configured. Please set OPENPHONE_API_KEY in your .env file.');
    return;
  }

  try {
    // Test 1: Create contact with address
    console.log('\n🔄 Test 1: Creating contact with address information...');
    const createResult = await openPhoneSyncService.createContact(customerDataWithAddress);
    
    if (createResult) {
      console.log('✅ Contact created successfully with address');
      console.log('Contact ID:', createResult.id);
      console.log('Contact data:', createResult);
    } else {
      console.log('❌ Contact creation failed');
    }

    // Test 2: Update contact with new address
    console.log('\n🔄 Test 2: Updating contact with new address...');
    const updatedCustomerData = {
      ...customerDataWithAddress,
      addressLine1: '456 Updated Street',
      addressLine2: 'Suite 10',
      city: 'Updated City',
      postcode: '54321',
      state: 'NY'
    };

    if (createResult) {
      const updateResult = await openPhoneSyncService.updateContact(createResult.id, updatedCustomerData);
      
      if (updateResult) {
        console.log('✅ Contact updated successfully with new address');
        console.log('Updated contact data:', updateResult);
      } else {
        console.log('❌ Contact update failed');
      }
    }

    // Test 3: Sync profile update with address
    console.log('\n🔄 Test 3: Testing profile sync with address...');
    const syncResult = await openPhoneSyncService.syncProfileUpdate('test-customer-id', customerDataWithAddress);
    
    if (syncResult) {
      console.log('✅ Profile sync successful with address');
      console.log('Sync result:', syncResult);
    } else {
      console.log('❌ Profile sync failed');
    }

    console.log('\n✅ OpenPhone address sync test completed!');

  } catch (error) {
    console.error('❌ Error during OpenPhone address sync test:', error.message);
  }
}

testOpenPhoneAddressSync().catch(console.error); 