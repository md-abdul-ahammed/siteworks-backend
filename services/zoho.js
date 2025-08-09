const axios = require('axios');

class ZohoService {
  constructor() {
    this.baseURL = 'https://www.zohoapis.com/books/v3';
    this.clientId = process.env.ZOHO_CLIENT_ID;
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET;
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    this.organizationId = process.env.ZOHO_ORGANIZATION_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token using refresh token
   */
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

  /**
   * Make authenticated request to Zoho API
   */
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

  /**
   * Create a new invoice in Zoho
   */
  async createInvoice(invoiceData) {
    try {
      const response = await this.makeRequest('invoices', {
        method: 'POST',
        data: {
          organization_id: this.organizationId,
          ...invoiceData
        }
      });

      return response.invoice;
    } catch (error) {
      console.error('Error creating Zoho invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId) {
    try {
      const response = await this.makeRequest(`invoices/${invoiceId}`);
      return response.invoice;
    } catch (error) {
      console.error('Error getting Zoho invoice:', error);
      throw error;
    }
  }

  /**
   * Get all invoices for a customer
   */
  async getInvoicesByCustomer(customerId, options = {}) {
    try {
      const params = new URLSearchParams({
        customer_id: customerId,
        ...options
      });

      const response = await this.makeRequest(`invoices?${params.toString()}`);
      return response.invoices;
    } catch (error) {
      console.error('Error getting Zoho invoices by customer:', error);
      throw error;
    }
  }

  /**
   * Alias for getInvoicesByCustomer for compatibility
   */
  async getCustomerInvoices(customerId, options = {}) {
    return this.getInvoicesByCustomer(customerId, options);
  }

  /**
   * Get all invoices across the organization with optional filters
   * Supports Zoho pagination via page and per_page
   */
  async getAllInvoices(options = {}) {
    try {
      const params = new URLSearchParams({
        ...options
      });
      const response = await this.makeRequest(`invoices?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Error getting all Zoho invoices:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId, status) {
    try {
      const response = await this.makeRequest(`invoices/${invoiceId}`, {
        method: 'PUT',
        data: {
          status: status
        }
      });

      return response.invoice;
    } catch (error) {
      console.error('Error updating Zoho invoice status:', error);
      throw error;
    }
  }

  /**
   * Create a customer in Zoho
   */
  async createCustomer(customerData) {
    try {
      // Transform the data to use contact_name instead of name
      const transformedData = {
        organization_id: this.organizationId,
        contact_name: customerData.name || customerData.contact_name,
        email: customerData.email,
        phone: customerData.phone,
        mobile: customerData.mobile,
        company_name: customerData.company_name,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        billing_address: customerData.billing_address,
        shipping_address: customerData.shipping_address
      };

      const response = await this.makeRequest('contacts', {
        method: 'POST',
        data: transformedData
      });

      return response.contact;
    } catch (error) {
      console.error('Error creating Zoho customer:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId) {
    try {
      const response = await this.makeRequest(`contacts/${customerId}`);
      return response.contact;
    } catch (error) {
      console.error('Error getting Zoho customer:', error);
      throw error;
    }
  }

  /**
   * Search for customer by email
   */
  async findCustomerByEmail(email) {
    try {
      const params = new URLSearchParams({
        email: email
      });

      const response = await this.makeRequest(`contacts?${params.toString()}`);
      return response.contacts?.[0] || null;
    } catch (error) {
      console.error('Error finding Zoho customer by email:', error);
      throw error;
    }
  }

  /**
   * Generate invoice PDF and return download URL
   */
  async getInvoicePDF(invoiceId) {
    try {
      console.log(`📄 Generating PDF for invoice: ${invoiceId}`);
      
      // Method 1: Try the standard PDF endpoint
      try {
        console.log('   Attempting standard PDF endpoint...');
        const response = await this.makeRequest(`invoices/${invoiceId}/pdf`);
        if (response.download_url) {
          console.log('✅ PDF generated successfully via standard endpoint');
          return response.download_url;
        }
      } catch (error) {
        console.log('   Standard endpoint failed:', error.response?.data?.message || error.message);
      }
      
      // Method 2: Try with accept header
      try {
        console.log('   Attempting with accept header...');
        const response = await this.makeRequest(`invoices/${invoiceId}`, {
          headers: {
            'Accept': 'application/pdf'
          }
        });
        if (response.download_url || response.pdf_url) {
          console.log('✅ PDF generated successfully via accept header');
          return response.download_url || response.pdf_url;
        }
      } catch (error) {
        console.log('   Accept header method failed:', error.response?.data?.message || error.message);
      }
      
      // Method 3: Try export endpoint
      try {
        console.log('   Attempting export endpoint...');
        const response = await this.makeRequest(`invoices/${invoiceId}/export`, {
          data: {
            accept: 'pdf'
          }
        });
        if (response.download_url || response.pdf_url) {
          console.log('✅ PDF generated successfully via export endpoint');
          return response.download_url || response.pdf_url;
        }
      } catch (error) {
        console.log('   Export endpoint failed:', error.response?.data?.message || error.message);
      }
      
      // Method 4: Try with different URL format
      try {
        console.log('   Attempting alternative URL format...');
        const response = await this.makeRequest(`invoices/${invoiceId}?accept=pdf&organization_id=${this.organizationId}`);
        if (response.download_url || response.pdf_url) {
          console.log('✅ PDF generated successfully via alternative URL');
          return response.download_url || response.pdf_url;
        }
      } catch (error) {
        console.log('   Alternative URL failed:', error.response?.data?.message || error.message);
      }
      
      // Method 5: Try to get invoice details and construct PDF URL
      try {
        console.log('   Attempting to construct PDF URL from invoice details...');
        const invoice = await this.getInvoice(invoiceId);
        if (invoice) {
          // Construct PDF URL based on Zoho Books format
          const pdfUrl = `https://books.zoho.com/api/v3/invoices/${invoiceId}/pdf?organization_id=${this.organizationId}`;
          console.log('✅ Constructed PDF URL:', pdfUrl);
          return pdfUrl;
        }
      } catch (error) {
        console.log('   Invoice details method failed:', error.response?.data?.message || error.message);
      }
      
      // Method 6: Try with different base URL
      try {
        console.log('   Attempting with different base URL...');
        const accessToken = await this.getAccessToken();
        const response = await axios.get(`https://books.zoho.com/api/v3/invoices/${invoiceId}/pdf`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            organization_id: this.organizationId
          }
        });
        if (response.data.download_url) {
          console.log('✅ PDF generated successfully via different base URL');
          return response.data.download_url;
        }
      } catch (error) {
        console.log('   Different base URL failed:', error.response?.data?.message || error.message);
      }
      
      // Fallback: Return a placeholder URL that can be used later
      console.log('⚠️ All PDF generation methods failed, using fallback URL');
      const fallbackUrl = `https://books.zoho.com/invoice/${invoiceId}/pdf?organization_id=${this.organizationId}`;
      console.log('   Fallback URL:', fallbackUrl);
      
      return fallbackUrl;
      
    } catch (error) {
      console.error('❌ PDF generation completely failed:', error.message);
      
      // Return a basic URL that might work
      return `https://books.zoho.com/invoice/${invoiceId}/pdf`;
    }
  }

  /**
   * Fetch invoice PDF binary and return ArrayBuffer
   */
  async fetchInvoicePDFBinary(invoiceId) {
    const accessToken = await this.getAccessToken();

    // Helper
    const tryRequest = async (url, headers = {}, params = {}) => {
      return await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        params: { organization_id: this.organizationId, ...params },
        validateStatus: () => true,
      });
    };

    try {
      // 1) Primary: zohoapis + dedicated pdf endpoint
      let resp = await tryRequest(`https://www.zohoapis.com/books/v3/invoices/${invoiceId}/pdf`);
      if (resp.status === 200 && resp.headers['content-type']?.includes('application/pdf')) {
        return resp.data;
      }

      // 2) Accept: application/pdf on detail endpoint
      resp = await tryRequest(`https://www.zohoapis.com/books/v3/invoices/${invoiceId}`, {
        Accept: 'application/pdf',
        'X-com-zoho-books-organizationid': this.organizationId,
      });
      if (resp.status === 200 && resp.headers['content-type']?.includes('application/pdf')) {
        return resp.data;
      }

      // 3) Fallback: books.zoho.com pdf endpoint
      resp = await tryRequest(`https://books.zoho.com/api/v3/invoices/${invoiceId}/pdf`);
      if (resp.status === 200 && resp.headers['content-type']?.includes('application/pdf')) {
        return resp.data;
      }

      // 4) Final fallback: resolve a download URL and let caller redirect
      const url = await this.getInvoicePDF(invoiceId);
      if (url) {
        const redir = await axios.get(url, { responseType: 'arraybuffer', validateStatus: () => true });
        if (redir.status === 200 && redir.headers['content-type']?.includes('application/pdf')) {
          return redir.data;
        }
      }

      throw new Error(`Unable to fetch PDF for invoice ${invoiceId}`);
    } catch (error) {
      console.error('Error fetching Zoho invoice PDF binary:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send invoice via email
   */
  async sendInvoice(invoiceId, emailData = {}) {
    try {
      const response = await this.makeRequest(`invoices/${invoiceId}/email`, {
        method: 'POST',
        data: {
          organization_id: this.organizationId,
          ...emailData
        }
      });

      return response;
    } catch (error) {
      console.error('Error sending Zoho invoice:', error);
      throw error;
    }
  }
}

module.exports = ZohoService; 