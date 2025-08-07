const ZohoService = require('./services/zoho');

async function testAllZohoCustomers() {
  try {
    console.log('🔍 Testing All Zoho Customers and Billing Data...\n');
    
    const zohoService = new ZohoService();
    
    // Test 1: Get access token
    console.log('1️⃣ Testing Zoho Access Token...');
    try {
      const token = await zohoService.getAccessToken();
      console.log('✅ Access Token:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('❌ Access Token Error:', error.message);
      return;
    }
    
    // Test 2: Get all customers from Zoho
    console.log('\n2️⃣ Fetching All Customers from Zoho...');
    try {
      // First, let's try to get all contacts
      const allContacts = await zohoService.makeRequest('contacts');
      console.log(`✅ Found ${allContacts.contacts?.length || 0} total contacts in Zoho`);
      
      if (allContacts.contacts && allContacts.contacts.length > 0) {
        console.log('\n📋 All Customers List:');
        allContacts.contacts.forEach((contact, index) => {
          console.log(`\n   Customer ${index + 1}:`);
          console.log(`   - Contact ID: ${contact.contact_id}`);
          console.log(`   - Name: ${contact.contact_name}`);
          console.log(`   - Email: ${contact.email || 'No email'}`);
          console.log(`   - Company: ${contact.company_name || 'No company'}`);
          console.log(`   - Phone: ${contact.phone || 'No phone'}`);
          console.log(`   - Status: ${contact.status || 'Unknown'}`);
          console.log(`   - Created: ${contact.created_time}`);
          
          // Get invoices for this customer
          getCustomerInvoices(zohoService, contact);
        });
      } else {
        console.log('❌ No customers found in Zoho');
      }
      
    } catch (error) {
      console.log('❌ Error fetching all customers:', error.message);
      console.log('Error details:', error.response?.data || error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function getCustomerInvoices(zohoService, customer) {
  try {
    console.log(`   📄 Fetching invoices for ${customer.contact_name}...`);
    const invoices = await zohoService.getInvoicesByCustomer(customer.contact_id);
    
    if (invoices && invoices.length > 0) {
      console.log(`   ✅ Found ${invoices.length} invoices:`);
      
      invoices.forEach((invoice, invIndex) => {
        console.log(`\n     Invoice ${invIndex + 1}:`);
        console.log(`     - Invoice ID: ${invoice.invoice_id}`);
        console.log(`     - Reference: ${invoice.reference || 'N/A'}`);
        console.log(`     - Status: ${invoice.status}`);
        console.log(`     - Total: ${invoice.total} ${invoice.currency_code}`);
        console.log(`     - Due Date: ${invoice.due_date}`);
        console.log(`     - Created: ${invoice.date}`);
        console.log(`     - Paid Date: ${invoice.paid_at || 'Not paid'}`);
        
        // Show line items if available
        if (invoice.line_items && invoice.line_items.length > 0) {
          console.log(`     - Line Items (${invoice.line_items.length}):`);
          invoice.line_items.forEach((item, itemIndex) => {
            console.log(`       ${itemIndex + 1}. ${item.name} - Qty: ${item.quantity} - Price: ${item.rate} - Total: ${item.item_total}`);
          });
        }
        
        // Test PDF generation for this invoice
        testInvoicePDF(zohoService, invoice);
      });
    } else {
      console.log(`   ❌ No invoices found for ${customer.contact_name}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error fetching invoices for ${customer.contact_name}:`, error.message);
  }
}

async function testInvoicePDF(zohoService, invoice) {
  try {
    console.log(`     📄 Testing PDF for invoice ${invoice.invoice_id}...`);
    const pdfUrl = await zohoService.getInvoicePDF(invoice.invoice_id);
    console.log(`     ✅ PDF URL: ${pdfUrl}`);
  } catch (error) {
    console.log(`     ❌ PDF generation failed: ${error.message}`);
  }
}

// Run the test
testAllZohoCustomers(); 