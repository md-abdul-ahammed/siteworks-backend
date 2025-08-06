require('dotenv').config();
const axios = require('axios');

async function deleteApiContacts() {
  console.log('=== Deleting API-Created OpenPhone Contacts ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  try {
    // Step 1: Get all contacts
    console.log('\n1. Fetching all contacts...');
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (!response.data?.data) {
      console.log('❌ No contacts found');
      return;
    }
    
    const allContacts = response.data.data;
    console.log(`✅ Found ${allContacts.length} total contacts`);
    
    // Step 2: Filter contacts created via API
    const apiContacts = allContacts.filter(contact => 
      contact.source === 'public-api'
    );
    
    console.log(`\n2. Found ${apiContacts.length} API-created contacts:`);
    apiContacts.forEach((contact, index) => {
      console.log(`   ${index + 1}. ${contact.defaultFields?.firstName || ''} ${contact.defaultFields?.lastName || ''}`);
      console.log(`      ID: ${contact.id}`);
      console.log(`      Email: ${contact.defaultFields?.emails?.[0]?.value || 'N/A'}`);
      console.log(`      Phone: ${contact.defaultFields?.phoneNumbers?.[0]?.value || 'N/A'}`);
      console.log(`      Source: ${contact.source}`);
      console.log('');
    });
    
    if (apiContacts.length === 0) {
      console.log('✅ No API-created contacts found to delete');
      return;
    }
    
    // Step 3: Confirm deletion
    console.log(`\n3. About to delete ${apiContacts.length} API-created contacts`);
    console.log('⚠️  This action cannot be undone!');
    console.log('📋 Contacts to be deleted:');
    apiContacts.forEach((contact, index) => {
      const name = `${contact.defaultFields?.firstName || ''} ${contact.defaultFields?.lastName || ''}`.trim() || 'Unknown';
      const email = contact.defaultFields?.emails?.[0]?.value || 'No email';
      console.log(`   ${index + 1}. ${name} (${email})`);
    });
    
    // Step 4: Delete each API-created contact
    console.log('\n4. Starting deletion process...');
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const contact of apiContacts) {
      try {
        console.log(`\n🗑️  Deleting contact: ${contact.defaultFields?.firstName || ''} ${contact.defaultFields?.lastName || ''}`);
        console.log(`   ID: ${contact.id}`);
        
        const deleteResponse = await axios.delete(`${baseUrl}/contacts/${contact.id}`, {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        if (deleteResponse.status === 204) {
          console.log('   ✅ Successfully deleted');
          deletedCount++;
        } else {
          console.log('   ❌ Unexpected response:', deleteResponse.status);
          failedCount++;
        }
        
      } catch (error) {
        console.log('   ❌ Failed to delete:', error.response?.data?.message || error.message);
        failedCount++;
      }
    }
    
    // Step 5: Summary
    console.log('\n=== Deletion Summary ===');
    console.log(`✅ Successfully deleted: ${deletedCount} contacts`);
    console.log(`❌ Failed to delete: ${failedCount} contacts`);
    console.log(`📊 Total API contacts found: ${apiContacts.length}`);
    
    if (deletedCount > 0) {
      console.log('\n🎉 API-created contacts have been removed!');
      console.log('✅ Only API-created contacts were deleted');
      console.log('✅ Manual contacts remain untouched');
    }
    
  } catch (error) {
    console.error('❌ Error during deletion process:', error.response?.data || error.message);
  }
}

deleteApiContacts().catch(console.error); 