require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const ZohoService = require('./services/zoho');

async function testZohoCustomerCreation() {
  console.log('🧪 Testing Zoho Customer Creation...\n');
  
  const prisma = new PrismaClient();
  const zoho = new ZohoService();
  
  try {
    // Get a test customer
    const customer = await prisma.customer.findFirst({
      where: {
        goCardlessMandateId: {
          not: null
        }
      }
    });

    if (!customer) {
      console.log('❌ No customer with GoCardless mandate found.');
      return;
    }

    console.log('👤 Test customer found:', customer.email);
    console.log('   Name:', `${customer.firstName} ${customer.lastName}`);
    console.log('   Phone:', customer.phone);
    console.log('   Address:', customer.addressLine1);
    console.log('');

    // Test 1: Try with original name
    console.log('1️⃣ Testing with original name...');
    try {
      const customerData = {
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone,
        billing_address: {
          address: customer.addressLine1,
          city: customer.city,
          state: customer.state,
          zip: customer.postcode,
          country: customer.countryOfResidence
        }
      };
      
      console.log('Customer data:', JSON.stringify(customerData, null, 2));
      
      const zohoCustomer = await zoho.createCustomer(customerData);
      console.log('✅ Customer created successfully with original name!');
      console.log('Zoho Customer ID:', zohoCustomer.contact_id);
      
    } catch (error) {
      console.log('❌ Failed with original name:', error.response?.data?.message || error.message);
      
      // Test 2: Try with cleaned name
      console.log('\n2️⃣ Testing with cleaned name...');
      try {
        const cleanedName = `${customer.firstName} ${customer.lastName}`.trim().replace(/[^\w\s]/g, '');
        const customerData = {
          name: cleanedName,
          email: customer.email,
          phone: customer.phone,
          billing_address: {
            address: customer.addressLine1,
            city: customer.city,
            state: customer.state,
            zip: customer.postcode,
            country: customer.countryOfResidence
          }
        };
        
        console.log('Cleaned name:', cleanedName);
        console.log('Customer data:', JSON.stringify(customerData, null, 2));
        
        const zohoCustomer = await zoho.createCustomer(customerData);
        console.log('✅ Customer created successfully with cleaned name!');
        console.log('Zoho Customer ID:', zohoCustomer.contact_id);
        
      } catch (error2) {
        console.log('❌ Failed with cleaned name:', error2.response?.data?.message || error2.message);
        
        // Test 3: Try with just first name
        console.log('\n3️⃣ Testing with just first name...');
        try {
          const customerData = {
            name: customer.firstName || 'Customer',
            email: customer.email,
            phone: customer.phone,
            billing_address: {
              address: customer.addressLine1,
              city: customer.city,
              state: customer.state,
              zip: customer.postcode,
              country: customer.countryOfResidence
            }
          };
          
          console.log('Customer data:', JSON.stringify(customerData, null, 2));
          
          const zohoCustomer = await zoho.createCustomer(customerData);
          console.log('✅ Customer created successfully with first name only!');
          console.log('Zoho Customer ID:', zohoCustomer.contact_id);
          
        } catch (error3) {
          console.log('❌ Failed with first name only:', error3.response?.data?.message || error3.message);
          
          // Test 4: Try with minimal data
          console.log('\n4️⃣ Testing with minimal data...');
          try {
            const customerData = {
              name: 'Test Customer',
              email: customer.email
            };
            
            console.log('Customer data:', JSON.stringify(customerData, null, 2));
            
            const zohoCustomer = await zoho.createCustomer(customerData);
            console.log('✅ Customer created successfully with minimal data!');
            console.log('Zoho Customer ID:', zohoCustomer.contact_id);
            
          } catch (error4) {
            console.log('❌ Failed with minimal data:', error4.response?.data?.message || error4.message);
            console.log('\n🔧 All customer creation attempts failed. Please check Zoho API documentation for valid field formats.');
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testZohoCustomerCreation().catch(console.error); 