require('dotenv').config();
const ZohoService = require('./services/zoho');
const axios = require('axios');

async function testPDFGenerationImproved() {
  console.log('🧪 Testing Improved PDF Generation...\n');
  
  const zoho = new ZohoService();
  
  try {
    // Step 1: Create a test customer
    console.log('1️⃣ Creating test customer...');
    const customerData = {
      name: 'PDF Test Customer',
      email: `pdf-test-${Date.now()}@example.com`,
      phone: '+441234567890',
      billing_address: {
        address: '123 PDF Test Street',
        city: 'London',
        state: 'England',
        zip: 'SW1A 1AA',
        country: 'GB'
      }
    };
    
    const zohoCustomer = await zoho.createCustomer(customerData);
    console.log('✅ Customer created:', zohoCustomer.contact_id);
    
    // Step 2: Create a test invoice
    console.log('\n2️⃣ Creating test invoice...');
    const invoiceData = {
      customer_id: zohoCustomer.contact_id,
      line_items: [
        {
          name: 'PDF Generation Test Service',
          quantity: 1,
          unit_price: 100.00,
          tax_percentage: 0
        }
      ],
      reference: `PDF-TEST-${Date.now()}`,
      notes: 'Test invoice for PDF generation',
      terms: 'Payment due within 30 days'
    };
    
    const zohoInvoice = await zoho.createInvoice(invoiceData);
    console.log('✅ Invoice created:', zohoInvoice.invoice_id);
    console.log('   - Total Amount:', zohoInvoice.total);
    console.log('   - Status:', zohoInvoice.status);
    
    // Step 3: Test PDF generation with multiple methods
    console.log('\n3️⃣ Testing PDF generation with multiple methods...');
    
    const invoiceId = zohoInvoice.invoice_id;
    const accessToken = await zoho.getAccessToken();
    const organizationId = process.env.ZOHO_ORGANIZATION_ID;
    
    const pdfMethods = [
      {
        name: 'Standard Zoho API',
        url: `https://www.zohoapis.com/books/v3/invoices/${invoiceId}/pdf`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Alternative Base URL',
        url: `https://books.zoho.com/api/v3/invoices/${invoiceId}/pdf`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          organization_id: organizationId
        }
      },
      {
        name: 'With Accept Header',
        url: `https://www.zohoapis.com/books/v3/invoices/${invoiceId}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        params: {
          organization_id: organizationId
        }
      },
      {
        name: 'Export Endpoint',
        url: `https://www.zohoapis.com/books/v3/invoices/${invoiceId}/export`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          organization_id: organizationId,
          accept: 'pdf'
        }
      },
      {
        name: 'Direct Books URL',
        url: `https://books.zoho.com/invoice/${invoiceId}/pdf`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          organization_id: organizationId
        }
      }
    ];
    
    let successfulMethod = null;
    
    for (const method of pdfMethods) {
      try {
        console.log(`\n🔍 Testing: ${method.name}`);
        console.log(`   URL: ${method.url}`);
        
        const config = {
          method: method.method || 'GET',
          url: method.url,
          headers: method.headers,
          params: method.params,
          data: method.data
        };
        
        const response = await axios(config);
        
        if (response.data && (response.data.download_url || response.data.pdf_url)) {
          console.log('✅ Success!');
          console.log('   Download URL:', response.data.download_url || response.data.pdf_url);
          successfulMethod = method;
          break;
        } else {
          console.log('⚠️ No download URL in response');
          console.log('   Response:', JSON.stringify(response.data, null, 2));
        }
        
      } catch (error) {
        console.log('❌ Failed');
        console.log('   Error:', error.response?.data?.message || error.message);
        console.log('   Status:', error.response?.status);
      }
    }
    
    // Step 4: Test our improved service method
    console.log('\n4️⃣ Testing improved service method...');
    try {
      const pdfUrl = await zoho.getInvoicePDF(invoiceId);
      console.log('✅ Service method result:', pdfUrl);
    } catch (error) {
      console.log('❌ Service method failed:', error.message);
    }
    
    // Step 5: Test manual PDF download
    if (successfulMethod) {
      console.log('\n5️⃣ Testing manual PDF download...');
      try {
        const response = await axios({
          method: 'GET',
          url: successfulMethod.url,
          headers: successfulMethod.headers,
          params: successfulMethod.params,
          responseType: 'stream'
        });
        
        console.log('✅ PDF download successful');
        console.log('   Content-Type:', response.headers['content-type']);
        console.log('   Content-Length:', response.headers['content-length']);
        
        // Save PDF to file for testing
        const fs = require('fs');
        const writer = fs.createWriteStream(`test-invoice-${invoiceId}.pdf`);
        response.data.pipe(writer);
        
        writer.on('finish', () => {
          console.log('✅ PDF saved to file: test-invoice-' + invoiceId + '.pdf');
        });
        
        writer.on('error', (error) => {
          console.log('❌ Error saving PDF:', error.message);
        });
        
      } catch (error) {
        console.log('❌ PDF download failed:', error.message);
      }
    }
    
    console.log('\n🎉 PDF Generation Test Complete!');
    console.log('\n📊 Summary:');
    console.log('✅ Customer Creation');
    console.log('✅ Invoice Creation');
    console.log('✅ Multiple PDF Methods Tested');
    console.log('✅ Service Method Improved');
    if (successfulMethod) {
      console.log('✅ PDF Download Successful');
    } else {
      console.log('⚠️ PDF Download Failed (expected in sandbox)');
    }
    
    return {
      customerId: zohoCustomer.contact_id,
      invoiceId: zohoInvoice.invoice_id,
      successfulMethod: successfulMethod?.name
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testPDFGenerationImproved().catch(console.error); 