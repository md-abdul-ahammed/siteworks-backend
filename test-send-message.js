require('dotenv').config();
const axios = require('axios');

async function testSendMessage() {
  console.log('=== Testing Send Message via OpenPhone API ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Get your phone number first
  console.log('\n1. Getting your OpenPhone number...');
  let yourPhoneNumber = null;
  
  try {
    const phoneResponse = await axios.get(`${baseUrl}/phone-numbers`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (phoneResponse.data?.data && phoneResponse.data.data.length > 0) {
      yourPhoneNumber = phoneResponse.data.data[0].number;
      console.log(`✅ Your phone number: ${yourPhoneNumber}`);
    } else {
      console.log('❌ No phone numbers found');
      return;
    }
    
  } catch (error) {
    console.log('❌ Failed to get phone numbers:', error.response?.data?.message || error.message);
    return;
  }
  
  // Test 1: Send message to the customer's phone number
  console.log('\n2. Sending welcome message to customer...');
  
  const customerPhone = '+17019976600'; // Md Abdul Shagar's phone
  const message = `Hi Md Abdul! Welcome to SiteWorks! 🎉 Your account has been successfully created. We're excited to have you on board. If you have any questions, feel free to reach out to us at (812) 515-1197. - Team SiteWorks`;
  
  try {
    const messagePayload = {
      to: customerPhone,
      from: yourPhoneNumber,
      body: message
    };
    
    console.log('📤 Sending message...');
    console.log('   From:', yourPhoneNumber);
    console.log('   To:', customerPhone);
    console.log('   Message:', message);
    
    const response = await axios.post(`${baseUrl}/messages`, messagePayload, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Message sent successfully!');
    console.log('Message ID:', response.data?.data?.id);
    console.log('Status:', response.data?.data?.status);
    console.log('Sent at:', response.data?.data?.createdAt);
    
  } catch (error) {
    console.log('❌ Failed to send message');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Test 2: Send message to a test number
  console.log('\n3. Testing with a different number...');
  
  const testPhone = '+1234567890'; // Test number
  const testMessage = `Hi! This is a test message from SiteWorks integration. 🚀`;
  
  try {
    const testPayload = {
      to: testPhone,
      from: yourPhoneNumber,
      body: testMessage
    };
    
    console.log('📤 Sending test message...');
    console.log('   From:', yourPhoneNumber);
    console.log('   To:', testPhone);
    console.log('   Message:', testMessage);
    
    const testResponse = await axios.post(`${baseUrl}/messages`, testPayload, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Test message sent successfully!');
    console.log('Message ID:', testResponse.data?.data?.id);
    console.log('Status:', testResponse.data?.data?.status);
    
  } catch (error) {
    console.log('❌ Failed to send test message');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
  }
  
  // Test 3: Check message history
  console.log('\n4. Checking message history...');
  
  try {
    const historyResponse = await axios.get(`${baseUrl}/messages`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      params: {
        limit: 5
      },
      timeout: 10000
    });
    
    console.log('✅ Message history retrieved');
    console.log('Recent messages:', historyResponse.data?.data?.length || 0);
    
    if (historyResponse.data?.data && historyResponse.data.data.length > 0) {
      console.log('\n📋 Recent Messages:');
      historyResponse.data.data.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${msg.direction} - ${msg.body?.substring(0, 50)}...`);
        console.log(`      From: ${msg.from} | To: ${msg.to} | Status: ${msg.status}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Failed to get message history:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== Message Test Complete ===');
  console.log('\n💡 Integration Status:');
  console.log('   - Message sending: Tested');
  console.log('   - Customer notification: Ready');
  console.log('   - Welcome messages: Can be automated');
  console.log('\n📋 Next Steps:');
  console.log('   1. Integrate message sending into signup flow');
  console.log('   2. Create welcome message templates');
  console.log('   3. Add error handling for failed messages');
}

testSendMessage().catch(console.error); 