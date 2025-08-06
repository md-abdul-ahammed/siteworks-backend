require('dotenv').config();
const axios = require('axios');

async function testSendMessageFixed() {
  console.log('=== Testing Send Message with Correct Format ===');
  
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
  
  // Test 1: Send message with correct format
  console.log('\n2. Sending welcome message to customer...');
  
  const customerPhone = '+17019976600'; // Md Abdul Shagar's phone
  const message = `Hi Md Abdul! Welcome to SiteWorks! 🎉 Your account has been successfully created. We're excited to have you on board. If you have any questions, feel free to reach out to us at (812) 515-1197. - Team SiteWorks`;
  
  try {
    // Correct OpenPhone API format
    const messagePayload = {
      to: [customerPhone], // Array of phone numbers
      from: yourPhoneNumber,
      content: message // Use 'content' instead of 'body'
    };
    
    console.log('📤 Sending message with correct format...');
    console.log('   From:', yourPhoneNumber);
    console.log('   To:', customerPhone);
    console.log('   Message:', message);
    console.log('   Payload:', JSON.stringify(messagePayload, null, 2));
    
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
  
  // Test 2: Try alternative format
  console.log('\n3. Trying alternative message format...');
  
  const testPhone = '+1234567890';
  const testMessage = `Hi! This is a test message from SiteWorks integration. 🚀`;
  
  try {
    // Alternative format
    const altPayload = {
      to: [testPhone],
      from: yourPhoneNumber,
      body: testMessage // Try 'body' instead of 'content'
    };
    
    console.log('📤 Sending test message with alternative format...');
    console.log('   Payload:', JSON.stringify(altPayload, null, 2));
    
    const altResponse = await axios.post(`${baseUrl}/messages`, altPayload, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Alternative format message sent successfully!');
    console.log('Message ID:', altResponse.data?.data?.id);
    console.log('Status:', altResponse.data?.data?.status);
    
  } catch (error) {
    console.log('❌ Failed to send alternative format message');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Test 3: Check OpenPhone API documentation format
  console.log('\n4. Trying documentation format...');
  
  try {
    // Based on OpenPhone API documentation
    const docPayload = {
      to: [customerPhone],
      from: yourPhoneNumber,
      content: `Welcome to SiteWorks! Your account is ready. 🎉`
    };
    
    console.log('📤 Sending message with documentation format...');
    console.log('   Payload:', JSON.stringify(docPayload, null, 2));
    
    const docResponse = await axios.post(`${baseUrl}/messages`, docPayload, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Documentation format message sent successfully!');
    console.log('Message ID:', docResponse.data?.data?.id);
    console.log('Status:', docResponse.data?.data?.status);
    
  } catch (error) {
    console.log('❌ Failed to send documentation format message');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== Message Test Complete ===');
  console.log('\n💡 Next Steps:');
  console.log('   1. Check OpenPhone API documentation for exact message format');
  console.log('   2. Verify phone number permissions for sending messages');
  console.log('   3. Test with a verified phone number');
  console.log('   4. Integrate successful format into signup flow');
}

testSendMessageFixed().catch(console.error); 