require('dotenv').config();
const OpenPhoneSyncService = require('./services/openphone-sync');
const OpenPhoneMessageService = require('./services/openphone-messages');

async function testCompleteProfileUpdate() {
  console.log('Testing complete profile update flow...\n');

  const openPhoneSyncService = new OpenPhoneSyncService();
  const openPhoneMessageService = new OpenPhoneMessageService();

  // Test data - simulate a profile update with phone change
  const oldCustomerData = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'SiteWorks',
    phone: '+1987654321',
    openPhoneContactId: null
  };

  const newCustomerData = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'SiteWorks',
    phone: '+1234567890', // Changed phone number
    openPhoneContactId: null
  };

  console.log('Old customer data:', oldCustomerData);
  console.log('New customer data:', newCustomerData);
  console.log('OpenPhone API configured:', openPhoneSyncService.isConfigured());
  console.log('Message service configured:', openPhoneMessageService.isConfigured());

  if (!openPhoneSyncService.isConfigured()) {
    console.log('❌ OpenPhone API key not configured. Please set OPENPHONE_API_KEY in your .env file.');
    return;
  }

  try {
    // Step 1: Test OpenPhone sync
    console.log('\n🔄 Step 1: Testing OpenPhone sync...');
    const syncResult = await openPhoneSyncService.syncProfileUpdate('test-customer-id', newCustomerData);
    
    if (syncResult) {
      console.log('✅ OpenPhone sync successful!');
      console.log('Contact data:', syncResult);
    } else {
      console.log('❌ OpenPhone sync failed');
    }

    // Step 2: Test phone update message
    console.log('\n🔄 Step 2: Testing phone update message...');
    const phoneChanged = oldCustomerData.phone !== newCustomerData.phone;
    
    if (phoneChanged) {
      console.log('📱 Phone number changed, sending update message...');
      const messageResult = await openPhoneMessageService.sendPhoneUpdateMessage(
        newCustomerData,
        oldCustomerData.phone,
        newCustomerData.phone
      );
      
      if (messageResult) {
        console.log('✅ Phone update message sent successfully!');
        console.log('Message ID:', messageResult.id);
        console.log('\nMessage content:');
        console.log(openPhoneMessageService.createPhoneUpdateMessage(
          newCustomerData,
          oldCustomerData.phone,
          newCustomerData.phone
        ));
      } else {
        console.log('❌ Phone update message failed');
      }
    } else {
      console.log('ℹ️ No phone number change detected');
    }

    console.log('\n✅ Complete profile update flow test completed!');

  } catch (error) {
    console.error('❌ Error during complete profile update test:', error.message);
  }
}

testCompleteProfileUpdate().catch(console.error); 