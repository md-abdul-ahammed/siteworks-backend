const ZohoService = require('./services/zoho');
const BillingIntegrationService = require('./services/billingIntegration');

async function testZohoBillingData() {
  try {
    console.log('🔍 Testing Zoho Billing Data Fetch...\n');
    
    const zohoService = new ZohoService();
    const billingService = new BillingIntegrationService();
    
    // Test 1: Get access token
    console.log('1️⃣ Testing Zoho Access Token...');
    try {
      const token = await zohoService.getAccessToken();
      console.log('✅ Access Token:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('❌ Access Token Error:', error.message);
      return;
    }
    
    // Test 2: Find a customer by email (use a test email)
    console.log('\n2️⃣ Testing Customer Search...');
    const testEmails = [
      'test@example.com',
      'admin@siteworkswebsites.com',
      'info@siteworkswebsites.com'
    ];
    
    let foundCustomer = null;
    for (const email of testEmails) {
      try {
        console.log(`   Searching for customer with email: ${email}`);
        const customer = await zohoService.findCustomerByEmail(email);
        if (customer) {
          console.log('✅ Found customer:', {
            contact_id: customer.contact_id,
            contact_name: customer.contact_name,
            email: customer.email,
            company_name: customer.company_name
          });
          foundCustomer = customer;
          break;
        } else {
          console.log('   ❌ No customer found with this email');
        }
      } catch (error) {
        console.log(`   ❌ Error searching for ${email}:`, error.message);
      }
    }
    
    if (!foundCustomer) {
      console.log('\n⚠️ No customers found. Creating a test customer...');
      try {
        const newCustomer = await zohoService.createCustomer({
          name: 'Test Customer',
          email: 'test@siteworkswebsites.com',
          phone: '+1234567890',
          billing_address: {
            address: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            zip: '12345',
            country: 'United States'
          }
        });
        console.log('✅ Created test customer:', {
          contact_id: newCustomer.contact_id,
          contact_name: newCustomer.contact_name,
          email: newCustomer.email
        });
        foundCustomer = newCustomer;
      } catch (error) {
        console.log('❌ Error creating test customer:', error.message);
        return;
      }
    }
    
    // Test 3: Get all invoices for the customer
    console.log('\n3️⃣ Testing Invoice Fetch...');
    try {
      const invoices = await zohoService.getInvoicesByCustomer(foundCustomer.contact_id);
      console.log(`✅ Found ${invoices.length} invoices for customer ${foundCustomer.contact_name}:`);
      
      invoices.forEach((invoice, index) => {
        console.log(`\n   Invoice ${index + 1}:`);
        console.log(`   - Invoice ID: ${invoice.invoice_id}`);
        console.log(`   - Reference: ${invoice.reference || 'N/A'}`);
        console.log(`   - Status: ${invoice.status}`);
        console.log(`   - Total: ${invoice.total} ${invoice.currency_code}`);
        console.log(`   - Due Date: ${invoice.due_date}`);
        console.log(`   - Created: ${invoice.date}`);
        console.log(`   - Paid Date: ${invoice.paid_at || 'Not paid'}`);
        console.log(`   - Line Items: ${invoice.line_items?.length || 0} items`);
        
        if (invoice.line_items && invoice.line_items.length > 0) {
          console.log('   - Line Items Details:');
          invoice.line_items.forEach((item, itemIndex) => {
            console.log(`     ${itemIndex + 1}. ${item.name} - Qty: ${item.quantity} - Price: ${item.rate} - Total: ${item.item_total}`);
          });
        }
      });
      
      // Test 4: Get specific invoice details
      if (invoices.length > 0) {
        console.log('\n4️⃣ Testing Specific Invoice Details...');
        const firstInvoice = invoices[0];
        try {
          const detailedInvoice = await zohoService.getInvoice(firstInvoice.invoice_id);
          console.log('✅ Detailed Invoice Data:');
          console.log(JSON.stringify(detailedInvoice, null, 2));
        } catch (error) {
          console.log('❌ Error getting detailed invoice:', error.message);
        }
      }
      
      // Test 5: Test PDF generation
      if (invoices.length > 0) {
        console.log('\n5️⃣ Testing PDF Generation...');
        const firstInvoice = invoices[0];
        try {
          const pdfUrl = await zohoService.getInvoicePDF(firstInvoice.invoice_id);
          console.log('✅ PDF URL:', pdfUrl);
        } catch (error) {
          console.log('❌ Error generating PDF:', error.message);
        }
      }
      
    } catch (error) {
      console.log('❌ Error fetching invoices:', error.message);
    }
    
    // Test 6: Test billing integration sync
    console.log('\n6️⃣ Testing Billing Integration Sync...');
    try {
      // Note: This would need a real customer ID from your database
      console.log('⚠️ Skipping sync test - needs real customer ID from database');
      console.log('   To test sync, you would need to:');
      console.log('   1. Create a customer in your database');
      console.log('   2. Set their email to match a Zoho customer');
      console.log('   3. Call billingService.syncBillingData(customerId)');
    } catch (error) {
      console.log('❌ Error in sync test:', error.message);
    }
    
    console.log('\n✅ Zoho Billing Data Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testZohoBillingData(); 