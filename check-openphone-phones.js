require('dotenv').config();
const axios = require('axios');

async function checkOpenPhonePhones() {
  console.log('=== Checking OpenPhone Phone Numbers ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Check 1: Get phone numbers from OpenPhone API
  console.log('\n1. Getting phone numbers from OpenPhone API...');
  try {
    const response = await axios.get(`${baseUrl}/phone-numbers`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Phone numbers retrieved successfully');
    console.log('Total phone numbers:', response.data?.data?.length || 0);
    
    if (response.data?.data && response.data.data.length > 0) {
      console.log('\n📱 Your OpenPhone Phone Numbers:');
      response.data.data.forEach((phone, index) => {
        console.log(`\n   Phone ${index + 1}:`);
        console.log(`   - Number: ${phone.phoneNumber}`);
        console.log(`   - ID: ${phone.id}`);
        console.log(`   - Type: ${phone.type || 'N/A'}`);
        console.log(`   - Status: ${phone.status || 'N/A'}`);
        console.log(`   - Name: ${phone.name || 'N/A'}`);
        console.log(`   - Country: ${phone.country || 'N/A'}`);
        console.log(`   - Created: ${phone.createdAt || 'N/A'}`);
        
        // Check if it's the primary number
        if (phone.isPrimary) {
          console.log(`   - ⭐ PRIMARY NUMBER`);
        }
      });
      
      // Find primary number
      const primaryPhone = response.data.data.find(phone => phone.isPrimary);
      if (primaryPhone) {
        console.log(`\n⭐ Primary Phone Number: ${primaryPhone.phoneNumber}`);
      }
      
    } else {
      console.log('❌ No phone numbers found in your OpenPhone account');
    }
    
  } catch (error) {
    console.log('❌ Failed to get phone numbers:', error.response?.data?.message || error.message);
    console.log('Status:', error.response?.status);
  }
  
  // Check 2: Get user info to see account details
  console.log('\n2. Getting user account information...');
  try {
    const userResponse = await axios.get(`${baseUrl}/user`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('✅ User info retrieved');
    console.log('Account details:', JSON.stringify(userResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Failed to get user info:', error.response?.data?.message || error.message);
  }
  
  // Check 3: Get workspace info
  console.log('\n3. Getting workspace information...');
  try {
    const workspaceResponse = await axios.get(`${baseUrl}/workspace`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('✅ Workspace info retrieved');
    console.log('Workspace details:', JSON.stringify(workspaceResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Failed to get workspace info:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== Phone Number Check Complete ===');
  console.log('\n💡 This shows all phone numbers configured in your OpenPhone account');
  console.log('   These are the numbers that can send/receive messages and calls');
}

checkOpenPhonePhones().catch(console.error); 