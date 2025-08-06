require('dotenv').config();
const axios = require('axios');

async function testOpenPhoneSources() {
  console.log('=== Testing OpenPhone Contact Sources ===');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Test 1: Get all contacts to see their sources
  console.log('\n1. Getting all contacts to analyze sources...');
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
    
    // Analyze sources
    const sources = {};
    response.data?.data?.forEach(contact => {
      const source = contact.source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });
    
    console.log('\n📊 Contact Sources Analysis:');
    Object.entries(sources).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} contacts`);
    });
    
    // Show recent contacts
    console.log('\n📋 Recent Contacts (last 5):');
    const recentContacts = response.data?.data?.slice(0, 5) || [];
    recentContacts.forEach((contact, index) => {
      console.log(`   ${index + 1}. ${contact.defaultFields?.firstName} ${contact.defaultFields?.lastName} (${contact.source})`);
    });
    
  } catch (error) {
    console.log('❌ Failed to get contacts:', error.response?.data?.message || error.message);
  }
  
  // Test 2: Create contact with different source values
  console.log('\n2. Testing different source values...');
  
  const testSources = [
    'public-api',
    'api',
    'openphone-api',
    'siteworks-api',
    'integration'
  ];
  
  for (const source of testSources) {
    console.log(`\n   Testing source: "${source}"`);
    
    try {
      const payload = {
        source: source,
        defaultFields: {
          firstName: `Test-${source}`,
          lastName: 'Source',
          company: `Source Test - ${source}`
        }
      };

      // Add email
      payload.defaultFields.emails = [{
        name: "primary",
        value: `test.${source}@siteworks.com`
      }];

      const response = await axios.post(`${baseUrl}/contacts`, payload, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log(`   ✅ Contact created with source "${source}"`);
      console.log(`   Contact ID: ${response.data?.data?.id}`);
      
      // Clean up immediately
      if (response.data?.data?.id) {
        try {
          await axios.delete(`${baseUrl}/contacts/${response.data.data.id}`, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json'
            }
          });
          console.log(`   ✅ Test contact cleaned up`);
        } catch (cleanupError) {
          console.log(`   ⚠️ Could not clean up test contact`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Failed with source "${source}": ${error.response?.data?.message || error.message}`);
    }
  }
  
  console.log('\n=== Source Test Complete ===');
  console.log('\n💡 The "OpenPhone API" source might be created automatically');
  console.log('   when contacts are created via API, but it may take time');
  console.log('   to appear in the dashboard or require specific source values.');
}

testOpenPhoneSources().catch(console.error); 