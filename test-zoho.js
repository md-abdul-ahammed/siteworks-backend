/**
 * Test script for Zoho API integration
 * Run with: node test-zoho.js
 */

require('dotenv').config();
const ZohoService = require('./services/zoho');

async function testZohoIntegration() {
  console.log('🧪 Testing Zoho Integration...\n');

  // Check environment variables
  console.log('📋 Environment Variables Check:');
  console.log('ZOHO_CLIENT_ID:', process.env.ZOHO_CLIENT_ID ? '✅ Set' : '❌ Missing');
  console.log('ZOHO_CLIENT_SECRET:', process.env.ZOHO_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('ZOHO_REFRESH_TOKEN:', process.env.ZOHO_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('ZOHO_ORGANIZATION_ID:', process.env.ZOHO_ORGANIZATION_ID ? '✅ Set' : '❌ Missing');

  // Check if all required variables are set
  if (!process.env.ZOHO_CLIENT_ID || 
      !process.env.ZOHO_CLIENT_SECRET || 
      !process.env.ZOHO_REFRESH_TOKEN || 
      !process.env.ZOHO_ORGANIZATION_ID) {
    console.log('\n❌ ERROR: Zoho credentials not configured!');
    console.log('\n📝 Setup Instructions:');
    console.log('1. Go to https://api-console.zoho.com/');
    console.log('2. Sign in to your Zoho account');
    console.log('3. Create a new Self-Client application');
    console.log('4. Add the following scopes:');
    console.log('   - ZohoBooks.invoices.READ');
    console.log('   - ZohoBooks.invoices.WRITE');
    console.log('   - ZohoBooks.contacts.READ');
    console.log('   - ZohoBooks.contacts.WRITE');
    console.log('5. Generate a refresh token');
    console.log('6. Update your .env file with the credentials');
    console.log('\n📚 Resources:');
    console.log('- Zoho API Console: https://api-console.zoho.com/');
    console.log('- Zoho Books API: https://www.zoho.com/books/api/');
    console.log('- Authentication Guide: https://www.zoho.com/books/api/v3/');
    return;
  }

  try {
    // Initialize Zoho service
    const zohoService = new ZohoService();
    console.log('✅ Zoho service initialized\n');

    // Test 1: Get access token
    console.log('🔑 Testing access token...');
    const accessToken = await zohoService.getAccessToken();
    console.log('✅ Access token obtained successfully\n');

    // Test 2: Create test customer
    console.log('👤 Testing customer creation...');
    const testCustomerData = {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '+1234567890',
      billing_address: {
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zip: '12345',
        country: 'US'
      }
    };

    const customer = await zohoService.createCustomer(testCustomerData);
    console.log('✅ Customer created successfully:', customer.contact_id);

    // Test 3: Create test invoice
    console.log('📄 Testing invoice creation...');
    const testInvoiceData = {
      customer_id: customer.contact_id,
      line_items: [{
        name: 'Test Service',
        quantity: 1,
        unit_price: 100.00,
        tax_percentage: 0
      }],
      reference: `TEST-INV-${Date.now()}`,
      notes: 'Test invoice created via API',
      terms: 'Payment due on receipt'
    };

    const invoice = await zohoService.createInvoice(testInvoiceData);
    console.log('✅ Invoice created successfully:', invoice.invoice_id);

    // Test 4: Get invoice details
    console.log('📋 Testing invoice retrieval...');
    const fetchedInvoice = await zohoService.getInvoice(invoice.invoice_id);
    console.log('✅ Invoice retrieved successfully');

    // Test 5: Get invoice PDF
    console.log('📄 Testing PDF generation...');
    const pdfUrl = await zohoService.getInvoicePDF(invoice.invoice_id);
    console.log('✅ PDF URL generated:', pdfUrl);

    // Test 6: Update invoice status
    console.log('🔄 Testing invoice status update...');
    const updatedInvoice = await zohoService.updateInvoiceStatus(invoice.invoice_id, 'sent');
    console.log('✅ Invoice status updated successfully');

    // Test 7: Find customer by email
    console.log('🔍 Testing customer search...');
    const foundCustomer = await zohoService.findCustomerByEmail('test@example.com');
    console.log('✅ Customer found:', foundCustomer ? foundCustomer.contact_id : 'Not found');

    // Test 8: Get invoices by customer
    console.log('📋 Testing customer invoices...');
    const customerInvoices = await zohoService.getInvoicesByCustomer(customer.contact_id);
    console.log('✅ Customer invoices retrieved:', customerInvoices.length, 'invoices');

    console.log('\n🎉 All tests passed! Zoho integration is working correctly.');
    console.log('\n📝 Next Steps:');
    console.log('1. Configure webhook endpoints in Zoho');
    console.log('2. Set up automatic invoice creation');
    console.log('3. Test webhook processing');
    console.log('4. Monitor invoice status updates');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your Zoho credentials');
    console.error('2. Verify your organization ID');
    console.error('3. Ensure you have the correct API permissions');
    console.error('4. Check the Zoho API status');
    console.error('5. Verify your refresh token is valid');
  }
}

// Run the test
testZohoIntegration(); 