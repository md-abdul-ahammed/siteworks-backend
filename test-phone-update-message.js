require('dotenv').config();
const OpenPhoneMessageService = require('./services/openphone-messages');

async function testPhoneUpdateMessage() {
  console.log('Testing phone update message functionality...\n');

  const openPhoneMessageService = new OpenPhoneMessageService();

  // Test data - simulate a phone number update
  const testCustomerData = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'SiteWorks',
    phone: '+1234567890'
  };

  const oldPhone = '+1987654321';
  const newPhone = '+1234567890';

  console.log('Test customer data:', testCustomerData);
  console.log('Old phone:', oldPhone);
  console.log('New phone:', newPhone);
  console.log('OpenPhone API configured:', openPhoneMessageService.isConfigured());

  if (!openPhoneMessageService.isConfigured()) {
    console.log('❌ OpenPhone API key not configured. Please set OPENPHONE_API_KEY in your .env file.');
    return;
  }

  try {
    console.log('\n🔄 Attempting to send phone update message...');
    
    const result = await openPhoneMessageService.sendPhoneUpdateMessage(
      testCustomerData,
      oldPhone,
      newPhone
    );
    
    if (result) {
      console.log('✅ Phone update message sent successfully!');
      console.log('Message ID:', result.id);
      console.log('Message content preview:');
      console.log(openPhoneMessageService.createPhoneUpdateMessage(testCustomerData, oldPhone, newPhone));
    } else {
      console.log('❌ Failed to send phone update message');
    }
  } catch (error) {
    console.error('❌ Error during phone update message test:', error.message);
  }
}

testPhoneUpdateMessage().catch(console.error); 