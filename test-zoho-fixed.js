require('dotenv').config();
const axios = require('axios');

class ZohoServiceFixed {
  constructor() {
    this.baseURL = 'https://www.zohoapis.com/books/v3';
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.organizationId = process.env.ZOHO_ORGANIZATION_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const params = new URLSearchParams();
      params.append('refresh_token', this.refreshToken);
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('grant_type', 'refresh_token');

      const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Zoho access token:', error.response?.data || error.message);
      throw new Error('Failed to get Zoho access token');
    }
  }

  async makeRequest(endpoint, options = {}) {
    const accessToken = await this.getAccessToken();
    
    const config = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await axios({
        method: options.method || 'GET',
        url: `${this.baseURL}/${endpoint}`,
        ...config
      });

      return response.data;
    } catch (error) {
      console.error('Zoho API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAllContacts() {
    try {
      const response = await this.makeRequest('contacts');
      return response.contacts || [];
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  }

  async getInvoicesByCustomer(customerId) {
    try {
      const params = new URLSearchParams({
        customer_id: customerId
      });

      const response = await this.makeRequest(`invoices?${params.toString()}`);
      return response.invoices || [];
    } catch (error) {
      console.error('Error getting invoices by customer:', error);
      throw error;
    }
  }
}

async function testZohoFixed() {
  try {
    console.log('🔍 Testing Zoho with Fixed Implementation...\n');
    
    const zohoService = new ZohoServiceFixed();
    
    // Test 1: Get access token
    console.log('1️⃣ Testing Zoho Access Token...');
    try {
      const token = await zohoService.getAccessToken();
      console.log('✅ Access Token:', token.substring(0, 20) + '...');
    } catch (error) {
      console.log('❌ Access Token Error:', error.message);
      return;
    }
    
    // Test 2: Get all contacts
    console.log('\n2️⃣ Fetching All Contacts from Zoho...');
    try {
      const contacts = await zohoService.getAllContacts();
      console.log(`✅ Found ${contacts.length} contacts in Zoho`);
      
      if (contacts.length > 0) {
        console.log('\n📋 All Contacts List:');
        contacts.forEach((contact, index) => {
          console.log(`\n   Contact ${index + 1}:`);
          console.log(`   - Contact ID: ${contact.contact_id}`);
          console.log(`   - Name: ${contact.contact_name}`);
          console.log(`   - Email: ${contact.email || 'No email'}`);
          console.log(`   - Company: ${contact.company_name || 'No company'}`);
          console.log(`   - Phone: ${contact.phone || 'No phone'}`);
          console.log(`   - Status: ${contact.status || 'Unknown'}`);
          console.log(`   - Created: ${contact.created_time}`);
          
          // Get invoices for this contact
          getContactInvoices(zohoService, contact);
        });
      } else {
        console.log('❌ No contacts found in Zoho');
      }
      
    } catch (error) {
      console.log('❌ Error fetching contacts:', error.message);
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function getContactInvoices(zohoService, contact) {
  try {
    console.log(`   📄 Fetching invoices for ${contact.contact_name}...`);
    const invoices = await zohoService.getInvoicesByCustomer(contact.contact_id);
    
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
      });
    } else {
      console.log(`   ❌ No invoices found for ${contact.contact_name}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error fetching invoices for ${contact.contact_name}:`, error.message);
  }
}

// Run the test
testZohoFixed(); 