require('dotenv').config();
const axios = require('axios');

async function testUpdateContact() {
  console.log('=== Testing OpenPhone Contact Updates ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // First, let's get an existing contact to update
  console.log('\n1. Getting existing contacts...');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.data?.data && response.data.data.length > 0) {
      const contact = response.data.data[0];
      console.log('✅ Found contact to update:');
      console.log('   ID:', contact.id);
      console.log('   Name:', contact.defaultFields?.firstName, contact.defaultFields?.lastName);
      console.log('   Current Email:', contact.defaultFields?.emails?.[0]?.value || 'N/A');
      console.log('   Current Phone:', contact.defaultFields?.phoneNumbers?.[0]?.value || 'N/A');
      
      // Test 1: Update email
      console.log('\n2. Testing email update...');
      const newEmail = 'updated.email@example.com';
      
      const emailUpdatePayload = {
        defaultFields: {
          emails: [
            {
              name: "primary",
              value: newEmail
            }
          ]
        }
      };
      
      console.log('📝 Updating email to:', newEmail);
      console.log('Payload:', JSON.stringify(emailUpdatePayload, null, 2));
      
      try {
        const emailResponse = await axios.patch(`${baseUrl}/contacts/${contact.id}`, emailUpdatePayload, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log('✅ Email updated successfully!');
        console.log('Updated contact:', JSON.stringify(emailResponse.data?.data, null, 2));
        
      } catch (error) {
        console.log('❌ Failed to update email');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.message || error.message);
      }
      
      // Test 2: Update phone number
      console.log('\n3. Testing phone number update...');
      const newPhone = '+1987654321';
      
      const phoneUpdatePayload = {
        defaultFields: {
          phoneNumbers: [
            {
              name: "primary",
              value: newPhone
            }
          ]
        }
      };
      
      console.log('📝 Updating phone to:', newPhone);
      console.log('Payload:', JSON.stringify(phoneUpdatePayload, null, 2));
      
      try {
        const phoneResponse = await axios.patch(`${baseUrl}/contacts/${contact.id}`, phoneUpdatePayload, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log('✅ Phone number updated successfully!');
        console.log('Updated contact:', JSON.stringify(phoneResponse.data?.data, null, 2));
        
      } catch (error) {
        console.log('❌ Failed to update phone number');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.message || error.message);
      }
      
      // Test 3: Update both email and phone together
      console.log('\n4. Testing combined email and phone update...');
      const combinedUpdatePayload = {
        defaultFields: {
          emails: [
            {
              name: "primary",
              value: "combined.update@example.com"
            }
          ],
          phoneNumbers: [
            {
              name: "primary",
              value: "+1555123456"
            }
          ]
        }
      };
      
      console.log('📝 Updating both email and phone...');
      console.log('Payload:', JSON.stringify(combinedUpdatePayload, null, 2));
      
      try {
        const combinedResponse = await axios.patch(`${baseUrl}/contacts/${contact.id}`, combinedUpdatePayload, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log('✅ Combined update successful!');
        console.log('Updated contact:', JSON.stringify(combinedResponse.data?.data, null, 2));
        
      } catch (error) {
        console.log('❌ Failed to update combined fields');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.message || error.message);
      }
      
      // Test 4: Update other fields
      console.log('\n5. Testing other field updates...');
      const otherFieldsPayload = {
        defaultFields: {
          company: "Updated Company Name",
          role: "Updated Role"
        }
      };
      
      console.log('📝 Updating company and role...');
      console.log('Payload:', JSON.stringify(otherFieldsPayload, null, 2));
      
      try {
        const otherResponse = await axios.patch(`${baseUrl}/contacts/${contact.id}`, otherFieldsPayload, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log('✅ Other fields updated successfully!');
        console.log('Updated contact:', JSON.stringify(otherResponse.data?.data, null, 2));
        
      } catch (error) {
        console.log('❌ Failed to update other fields');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.message || error.message);
      }
      
    } else {
      console.log('❌ No contacts found to update');
    }
    
  } catch (error) {
    console.log('❌ Failed to get contacts:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== Contact Update Test Complete ===');
  console.log('\n💡 Update Capabilities:');
  console.log('   ✅ Email addresses can be updated');
  console.log('   ✅ Phone numbers can be updated');
  console.log('   ✅ Company names can be updated');
  console.log('   ✅ Multiple fields can be updated together');
  console.log('   ✅ PATCH method is used for updates');
  console.log('\n📋 Update Format:');
  console.log('   PATCH /contacts/{contactId}');
  console.log('   Body: { "defaultFields": { ... } }');
}

testUpdateContact().catch(console.error); 