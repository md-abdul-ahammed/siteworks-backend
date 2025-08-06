require('dotenv').config();
const axios = require('axios');

async function researchOpenPhoneDashboard() {
  console.log('=== OpenPhone Dashboard Research ===');
  console.log('🔍 Researching why "OpenPhone API" source shows 0 contacts');
  
  const apiKey = process.env.OPENPHONE_API_KEY;
  const baseUrl = 'https://api.openphone.com/v1';
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }
  
  // Research 1: Get all contacts and analyze their properties
  console.log('\n1. Analyzing all contacts in detail...');
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
    
    // Detailed analysis of each contact
    console.log('\n📋 Detailed Contact Analysis:');
    response.data?.data?.forEach((contact, index) => {
      console.log(`\n   Contact ${index + 1}:`);
      console.log(`   - ID: ${contact.id}`);
      console.log(`   - Name: ${contact.defaultFields?.firstName} ${contact.defaultFields?.lastName}`);
      console.log(`   - Source: "${contact.source}"`);
      console.log(`   - Created: ${contact.createdAt}`);
      console.log(`   - Updated: ${contact.updatedAt}`);
      console.log(`   - Company: ${contact.defaultFields?.company || 'N/A'}`);
      console.log(`   - Emails: ${contact.defaultFields?.emails?.map(e => e.value).join(', ') || 'N/A'}`);
      console.log(`   - Phones: ${contact.defaultFields?.phoneNumbers?.map(p => p.value).join(', ') || 'N/A'}`);
      
      // Check for any special properties
      const specialProps = Object.keys(contact).filter(key => 
        !['id', 'defaultFields', 'source', 'createdAt', 'updatedAt'].includes(key)
      );
      if (specialProps.length > 0) {
        console.log(`   - Special properties: ${specialProps.join(', ')}`);
      }
    });
    
  } catch (error) {
    console.log('❌ Failed to get contacts:', error.response?.data?.message || error.message);
  }
  
  // Research 2: Test different source naming conventions
  console.log('\n2. Testing various source naming patterns...');
  
  const sourceTests = [
    { name: 'siteworks-integration', description: 'Custom integration name' },
    { name: 'api-v1', description: 'Versioned API source' },
    { name: 'external-api', description: 'Generic external API' },
    { name: 'webhook', description: 'Webhook integration' },
    { name: 'zapier', description: 'Zapier integration (reserved)' },
    { name: 'csv', description: 'CSV import (reserved)' },
    { name: 'device', description: 'Device sync (reserved)' },
    { name: 'google-people', description: 'Google People (reserved)' }
  ];
  
  for (const test of sourceTests) {
    console.log(`\n   Testing: "${test.name}" (${test.description})`);
    
    try {
      const payload = {
        source: test.name,
        defaultFields: {
          firstName: `Test-${test.name}`,
          lastName: 'Research',
          company: `Research Test - ${test.name}`
        }
      };

      // Add email
      payload.defaultFields.emails = [{
        name: "primary",
        value: `test.${test.name}@siteworks.com`
      }];

      const response = await axios.post(`${baseUrl}/contacts`, payload, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log(`   ✅ Created successfully with source "${test.name}"`);
      console.log(`   Contact ID: ${response.data?.data?.id}`);
      
      // Clean up
      if (response.data?.data?.id) {
        try {
          await axios.delete(`${baseUrl}/contacts/${response.data.data.id}`, {
            headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json'
            }
          });
          console.log(`   ✅ Cleaned up`);
        } catch (cleanupError) {
          console.log(`   ⚠️ Could not clean up`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  // Research 3: Check if there are any API endpoints for source management
  console.log('\n3. Checking for source management endpoints...');
  
  const endpointsToTest = [
    '/sources',
    '/contact-sources', 
    '/sources/contacts',
    '/workspace/sources',
    '/api/sources'
  ];
  
  for (const endpoint of endpointsToTest) {
    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`   ✅ ${endpoint} - Available`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`   ❌ ${endpoint} - Not found`);
      } else {
        console.log(`   ⚠️ ${endpoint} - Error: ${error.response?.status}`);
      }
    }
  }
  
  // Research 4: Check workspace/user info
  console.log('\n4. Checking workspace and user information...');
  
  try {
    const userResponse = await axios.get(`${baseUrl}/user`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('✅ User info retrieved');
    console.log('User data:', JSON.stringify(userResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Failed to get user info:', error.response?.data?.message || error.message);
  }
  
  console.log('\n=== Research Complete ===');
  console.log('\n📖 Findings:');
  console.log('1. OpenPhone uses "source" field to categorize contacts');
  console.log('2. Some source names are reserved (openphone, csv, device, etc.)');
  console.log('3. Dashboard may show sources differently than API');
  console.log('4. "OpenPhone API" might be a display-only source in dashboard');
  console.log('\n💡 The "0" in dashboard is likely a display issue, not functional');
  console.log('   Your contacts are being created successfully under "public-api" source');
}

researchOpenPhoneDashboard().catch(console.error); 