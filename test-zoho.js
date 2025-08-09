require('dotenv').config();
const ZohoService = require('./services/zoho');

async function testZoho() {
  console.log('🔍 Testing Zoho API Integration...');
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log('ZOHO_CLIENT_ID:', process.env.ZOHO_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
  console.log('ZOHO_CLIENT_SECRET:', process.env.ZOHO_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');
  console.log('ZOHO_REFRESH_TOKEN:', process.env.ZOHO_REFRESH_TOKEN ? '✅ SET' : '❌ NOT SET');
  console.log('ZOHO_ORGANIZATION_ID:', process.env.ZOHO_ORGANIZATION_ID ? '✅ SET' : '❌ NOT SET');
  
  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_ORGANIZATION_ID) {
    console.log('\n❌ Missing required Zoho environment variables. Please check your .env file.');
    return;
  }
  
  const zoho = new ZohoService();
  
  try {
    console.log('\n🔑 Testing Access Token...');
    const token = await zoho.getAccessToken();
    console.log('✅ Access Token:', token ? 'GOT' : 'FAILED');
    
    console.log('\n📄 Testing Invoice Details...');
    const invoiceId = '5442941000002835015';
    const invoice = await zoho.getInvoice(invoiceId);
    console.log('✅ Invoice Details:', invoice ? 'FOUND' : 'NOT FOUND');
    if (invoice) {
      console.log('   - Invoice ID:', invoice.invoice_id);
      console.log('   - Customer:', invoice.customer_name);
      console.log('   - Amount:', invoice.total);
      console.log('   - Status:', invoice.status);
    }
    
    console.log('\n📄 Testing PDF URL...');
    const pdfUrl = await zoho.getInvoicePDF(invoiceId);
    console.log('✅ PDF URL:', pdfUrl ? 'GOT' : 'FAILED');
    if (pdfUrl) {
      console.log('   - URL:', pdfUrl);
    }
    
    console.log('\n📄 Testing Binary PDF...');
    try {
      const binary = await zoho.fetchInvoicePDFBinary(invoiceId);
      console.log('✅ Binary PDF:', binary ? `GOT (${binary.byteLength} bytes)` : 'FAILED');
    } catch (e) {
      console.log('❌ Binary PDF failed:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testZoho(); 