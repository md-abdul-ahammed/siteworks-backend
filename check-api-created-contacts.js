require('dotenv').config();
const axios = require('axios');

async function checkAPICreatedContacts() {
  console.log('=== Checking Contacts Created via OpenPhone API ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Get all contacts and filter by source
  console.log('\n1. Getting all contacts from OpenPhone...');
  try {
    const response = await axios.get(`${baseUrl}/contacts`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Contacts retrieved successfully');
    console.log('Total contacts:', response.data?.data?.length || 0);
    
    if (response.data?.data && response.data.data.length > 0) {
      // Filter contacts by source
      const apiContacts = response.data.data.filter(contact => 
        contact.source === 'public-api' || 
        contact.source === 'api' || 
        contact.source === 'siteworks-integration' ||
        contact.source === 'integration'
      );
      
      const manualContacts = response.data.data.filter(contact => 
        !contact.source || 
        contact.source === 'unknown' || 
        contact.source === 'ios' ||
        contact.source === 'device'
      );
      
      console.log('\n📊 Contact Analysis:');
      console.log(`   API Created Contacts: ${apiContacts.length}`);
      console.log(`   Manual/Other Contacts: ${manualContacts.length}`);
      
      // Show API-created contacts
      if (apiContacts.length > 0) {
        console.log('\n🎯 CONTACTS CREATED VIA API:');
        apiContacts.forEach((contact, index) => {
          console.log(`\n   Contact ${index + 1}:`);
          console.log(`   - ID: ${contact.id}`);
          console.log(`   - Name: ${contact.defaultFields?.firstName} ${contact.defaultFields?.lastName}`);
          console.log(`   - Source: "${contact.source}"`);
          console.log(`   - Company: ${contact.defaultFields?.company || 'N/A'}`);
          console.log(`   - Emails: ${contact.defaultFields?.emails?.map(e => e.value).join(', ') || 'N/A'}`);
          console.log(`   - Phones: ${contact.defaultFields?.phoneNumbers?.map(p => p.value).join(', ') || 'N/A'}`);
          console.log(`   - Created: ${contact.createdAt}`);
          console.log(`   - Updated: ${contact.updatedAt}`);
          
          // Check if this is a SiteWorks customer
          if (contact.defaultFields?.company && contact.defaultFields.company.includes('SiteWorks')) {
            console.log(`   - 🏢 SITEWORKS CUSTOMER`);
          }
          
          // Check if this is a test contact
          if (contact.defaultFields?.firstName?.includes('Test') || contact.defaultFields?.lastName?.includes('Test')) {
            console.log(`   - 🧪 TEST CONTACT`);
          }
        });
        
        console.log(`\n✅ Found ${apiContacts.length} contacts created via API`);
        
      } else {
        console.log('\n❌ No API-created contacts found');
        console.log('   This might mean:');
        console.log('   - Contacts were created manually');
        console.log('   - API contacts have different source names');
        console.log('   - No contacts have been created via API yet');
      }
      
      // Show all contacts with their sources
      console.log('\n📋 ALL CONTACTS WITH SOURCES:');
      response.data.data.forEach((contact, index) => {
        const name = `${contact.defaultFields?.firstName || ''} ${contact.defaultFields?.lastName || ''}`.trim();
        const company = contact.defaultFields?.company || 'N/A';
        const source = contact.source || 'unknown';
        
        console.log(`   ${index + 1}. ${name} (${company}) - Source: "${source}"`);
      });
      
    } else {
      console.log('❌ No contacts found in your OpenPhone account');
    }
    
  } catch (error) {
    console.log('❌ Failed to get contacts:', error.response?.data?.message || error.message);
    console.log('Status:', error.response?.status);
  }
  
  // Check for recent API activity
  console.log('\n2. Checking for recent API activity...');
  try {
    const recentResponse = await axios.get(`${baseUrl}/contacts?limit=10`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (recentResponse.data?.data && recentResponse.data.data.length > 0) {
      console.log('\n🕒 Recent Contacts (last 10):');
      recentResponse.data.data.forEach((contact, index) => {
        const name = `${contact.defaultFields?.firstName || ''} ${contact.defaultFields?.lastName || ''}`.trim();
        const source = contact.source || 'unknown';
        const created = new Date(contact.createdAt).toLocaleDateString();
        
        console.log(`   ${index + 1}. ${name} - Source: "${source}" - Created: ${created}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Failed to get recent contacts:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== API Contact Check Complete ===');
  console.log('\n💡 To identify API-created contacts:');
  console.log('   - Look for source: "public-api" (most common)');
  console.log('   - Check for SiteWorks-related company names');
  console.log('   - Look for test contacts with "Test" in the name');
  console.log('   - Check creation dates for recent API activity');
}

checkAPICreatedContacts().catch(console.error); 