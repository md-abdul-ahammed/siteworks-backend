require('dotenv').config();
const axios = require('axios');

async function checkPhoneNumberStatus() {
  console.log('=== Checking OpenPhone Phone Number Status ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Check phone number details
  console.log('\n1. Getting phone number details...');
  try {
    const response = await axios.get(`${baseUrl}/phone-numbers`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Phone numbers retrieved successfully');
    
    if (response.data?.data && response.data.data.length > 0) {
      response.data.data.forEach((phone, index) => {
        console.log(`\n📱 Phone Number ${index + 1}:`);
        console.log(`   - Number: ${phone.number}`);
        console.log(`   - Formatted: ${phone.formattedNumber}`);
        console.log(`   - ID: ${phone.id}`);
        console.log(`   - Name: ${phone.name}`);
        console.log(`   - Created: ${phone.createdAt}`);
        console.log(`   - Updated: ${phone.updatedAt}`);
        console.log(`   - Symbol: ${phone.symbol}`);
        
        // Check for temporary number indicators
        console.log(`\n🔍 Temporary Number Analysis:`);
        
        // Check if it's a temporary number
        const isTemporary = phone.number?.includes('temp') || 
                           phone.name?.toLowerCase().includes('temp') ||
                           phone.formattedNumber?.includes('temp');
        
        if (isTemporary) {
          console.log(`   ⚠️ TEMPORARY NUMBER DETECTED`);
          console.log(`   - This might affect contact display`);
          console.log(`   - Temporary numbers may have limited functionality`);
        } else {
          console.log(`   ✅ Appears to be a regular number`);
        }
        
        // Check restrictions
        if (phone.restrictions) {
          console.log(`\n📋 Phone Number Restrictions:`);
          console.log(`   - Messaging US: ${phone.restrictions.messaging?.US || 'N/A'}`);
          console.log(`   - Messaging CA: ${phone.restrictions.messaging?.CA || 'N/A'}`);
          console.log(`   - Messaging Intl: ${phone.restrictions.messaging?.Intl || 'N/A'}`);
          console.log(`   - Calling US: ${phone.restrictions.calling?.US || 'N/A'}`);
          console.log(`   - Calling CA: ${phone.restrictions.calling?.CA || 'N/A'}`);
          console.log(`   - Calling Intl: ${phone.restrictions.calling?.Intl || 'N/A'}`);
        }
        
        // Check users assigned to this number
        if (phone.users && phone.users.length > 0) {
          console.log(`\n👥 Users assigned to this number:`);
          phone.users.forEach(user => {
            console.log(`   - ${user.firstName} ${user.lastName} (${user.role})`);
            console.log(`     Email: ${user.email}`);
          });
        }
      });
      
    } else {
      console.log('❌ No phone numbers found');
    }
    
  } catch (error) {
    console.log('❌ Failed to get phone numbers:', error.response?.data?.message || error.message);
  }
  
  // Check if temporary numbers affect contact display
  console.log('\n2. Checking contact display with current phone number...');
  try {
    const contactsResponse = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Contacts retrieved successfully');
    console.log('Total contacts:', contactsResponse.data?.data?.length || 0);
    
    // Check if contacts are visible
    if (contactsResponse.data?.data && contactsResponse.data.data.length > 0) {
      console.log('\n📋 Contact Visibility Check:');
      console.log('   - Contacts are accessible via API');
      console.log('   - This means the phone number can see contacts');
      
      // Check API-created contacts specifically
      const apiContacts = contactsResponse.data.data.filter(contact => 
        contact.source === 'public-api'
      );
      
      console.log(`   - API-created contacts: ${apiContacts.length}`);
      
      if (apiContacts.length > 0) {
        console.log('   ✅ API contacts are visible');
      } else {
        console.log('   ⚠️ No API contacts found (might be temporary number issue)');
      }
      
    } else {
      console.log('❌ No contacts visible - this might be due to temporary number');
    }
    
  } catch (error) {
    console.log('❌ Failed to get contacts:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== Phone Number Status Check Complete ===');
  console.log('\n💡 Temporary Number Impact:');
  console.log('   - Temporary numbers may have limited functionality');
  console.log('   - They might not show contacts in dashboard properly');
  console.log('   - API access should still work for contact creation');
  console.log('   - Consider upgrading to a permanent number for full features');
}

checkPhoneNumberStatus().catch(console.error); 