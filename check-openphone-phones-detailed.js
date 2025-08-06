require('dotenv').config();
const axios = require('axios');

async function checkOpenPhonePhonesDetailed() {
  console.log('=== Detailed OpenPhone Phone Numbers Check ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Check 1: Get phone numbers with detailed response
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
    console.log('Response status:', response.status);
    console.log('Total phone numbers:', response.data?.data?.length || 0);
    
    // Log the full response to see the structure
    console.log('\n📋 Full API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data?.data && response.data.data.length > 0) {
      console.log('\n📱 Your OpenPhone Phone Numbers:');
      response.data.data.forEach((phone, index) => {
        console.log(`\n   Phone ${index + 1}:`);
        console.log(`   - Full object:`, JSON.stringify(phone, null, 2));
        
        // Try different possible field names
        const possibleNumberFields = [
          'phoneNumber', 'number', 'phone', 'phone_number', 
          'value', 'phoneNumber', 'phone_number'
        ];
        
        let foundNumber = null;
        for (const field of possibleNumberFields) {
          if (phone[field]) {
            foundNumber = phone[field];
            console.log(`   - Number (${field}): ${foundNumber}`);
            break;
          }
        }
        
        if (!foundNumber) {
          console.log(`   - Number: NOT FOUND (available fields: ${Object.keys(phone).join(', ')})`);
        }
        
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
        console.log(`\n⭐ Primary Phone Number ID: ${primaryPhone.id}`);
        console.log(`   Name: ${primaryPhone.name}`);
      }
      
    } else {
      console.log('❌ No phone numbers found in your OpenPhone account');
    }
    
  } catch (error) {
    console.log('❌ Failed to get phone numbers');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);
    console.log('Full error response:', JSON.stringify(error.response?.data, null, 2));
  }
  
  // Check 2: Try to get phone numbers with different endpoint
  console.log('\n2. Trying alternative phone number endpoints...');
  
  const alternativeEndpoints = [
    '/numbers',
    '/phone-numbers',
    '/workspace/phone-numbers',
    '/user/phone-numbers'
  ];
  
  for (const endpoint of alternativeEndpoints) {
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`✅ ${endpoint} - Available`);
      console.log(`Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`❌ ${endpoint} - Not found`);
      } else {
        console.log(`⚠️ ${endpoint} - Error: ${error.response?.status}`);
      }
    }
  }
  
  console.log('\n=== Detailed Phone Number Check Complete ===');
  console.log('\n💡 Based on the dashboard screenshot, you should have:');
  console.log('   - Primary: (812) 515-1197');
  console.log('   - This number should appear in the API response');
}

checkOpenPhonePhonesDetailed().catch(console.error); 