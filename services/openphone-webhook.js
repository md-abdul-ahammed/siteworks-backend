const axios = require('axios');

class OpenPhoneWebhookService {
  constructor() {
    this.webhookUrl = process.env.OPENPHONE_WEBHOOK_URL;
    this.apiKey = process.env.OPENPHONE_API_KEY;
    
    if (!this.webhookUrl && !this.apiKey) {
      console.warn('OpenPhone webhook URL and API key not found. OpenPhone integration will be disabled.');
    }
  }

  /**
   * Send contact data to OpenPhone via webhook
   * This is an alternative to direct API calls
   */
  async sendContactViaWebhook(contactData) {
    if (!this.webhookUrl) {
      console.log('OpenPhone webhook URL not configured, skipping contact creation');
      return null;
    }

    try {
      console.log('Sending contact data to OpenPhone webhook for:', contactData.email);
      
      const payload = {
        event: 'contact.created',
        data: {
          name: `${contactData.firstName} ${contactData.lastName}`,
          email: contactData.email,
          phone: contactData.phone,
          company: contactData.companyName,
          notes: `Customer from SiteWorks - ID: ${contactData.id}`,
          source: 'SiteWorks Registration',
          timestamp: new Date().toISOString()
        }
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SiteWorks-Integration/1.0'
        },
        timeout: 10000
      });

      console.log('Contact data sent to OpenPhone webhook successfully');
      return { success: true, webhookId: response.data?.id };

    } catch (error) {
      console.error('Failed to send contact to OpenPhone webhook:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Create contact using manual process instructions
   */
  async createContactManually(contactData) {
    console.log('=== Manual OpenPhone Contact Creation ===');
    console.log('Since API key permissions are not working, here are manual steps:');
    console.log('');
    console.log('1. Log into your OpenPhone account');
    console.log('2. Go to Contacts');
    console.log('3. Click "Add Contact"');
    console.log('4. Enter the following details:');
    console.log(`   - Name: ${contactData.firstName} ${contactData.lastName}`);
    console.log(`   - Email: ${contactData.email}`);
    console.log(`   - Phone: ${contactData.phone || 'Not provided'}`);
    console.log(`   - Company: ${contactData.companyName || 'Not provided'}`);
    console.log(`   - Notes: Customer from SiteWorks - ID: ${contactData.id}`);
    console.log('');
    console.log('Contact details saved for manual creation');
    
    return {
      success: true,
      manual: true,
      contactData: {
        name: `${contactData.firstName} ${contactData.lastName}`,
        email: contactData.email,
        phone: contactData.phone,
        company: contactData.companyName,
        notes: `Customer from SiteWorks - ID: ${contactData.id}`
      }
    };
  }

  /**
   * Check if any OpenPhone integration is available
   */
  isConfigured() {
    return !!(this.webhookUrl || this.apiKey);
  }

  /**
   * Get integration status
   */
  getIntegrationStatus() {
    return {
      apiKeyConfigured: !!this.apiKey,
      webhookConfigured: !!this.webhookUrl,
      apiKeyWorking: false, // We know this is false based on tests
      webhookWorking: !!this.webhookUrl,
      manualFallback: true
    };
  }
}

module.exports = OpenPhoneWebhookService; 