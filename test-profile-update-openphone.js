require('dotenv').config();
const OpenPhoneSyncService = require('./services/openphone-sync');

async function testProfileUpdateSync() {
  console.log('Testing profile update sync with OpenPhone...\n');

  const openPhoneSyncService = new OpenPhoneSyncService();

  // Test data - simulate a profile update
  const testCustomerData = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Test Company',
    phone: '+1234567890',
    openPhoneContactId: null // This will be null for new contacts
  };

  console.log('Test customer data:', testCustomerData);
  console.log('OpenPhone API configured:', openPhoneSyncService.isConfigured());

  if (!openPhoneSyncService.isConfigured()) {
    console.log('❌ OpenPhone API key not configured. Please set OPENPHONE_API_KEY in your .env file.');
    return;
  }

  try {
    console.log('\n🔄 Attempting to sync profile update with OpenPhone...');
    
    const result = await openPhoneSyncService.syncProfileUpdate('test-customer-id', testCustomerData);
    
    if (result) {
      console.log('✅ Profile update synced successfully with OpenPhone!');
      console.log('OpenPhone contact data:', result);
    } else {
      console.log('❌ Failed to sync profile update with OpenPhone');
    }
  } catch (error) {
    console.error('❌ Error during profile update sync:', error.message);
  }
}

testProfileUpdateSync().catch(console.error); 