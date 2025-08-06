const axios = require('axios');

class OpenPhoneMessageService {
  constructor() {
    this.apiKey = process.env.OPENPHONE_API_KEY;
    this.baseUrl = 'https://api.openphone.com/v1';
    
    if (!this.apiKey) {
      console.warn('OpenPhone API key not found. Message sending will be disabled.');
    }
  }

  async getPhoneNumber() {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/phone-numbers`, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data?.data && response.data.data.length > 0) {
        return response.data.data[0].number;
      }
      return null;
    } catch (error) {
      console.error('Failed to get phone number:', error.response?.data || error.message);
      return null;
    }
  }

  async sendWelcomeMessage(customerData) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping welcome message');
      return null;
    }

    try {
      const fromNumber = await this.getPhoneNumber();
      if (!fromNumber) {
        console.log('No phone number available for sending messages');
        return null;
      }

      if (!customerData.phone) {
        console.log('No customer phone number provided for welcome message');
        return null;
      }

      console.log('Sending welcome message to:', customerData.phone);

      const message = this.createWelcomeMessage(customerData);
      
      const payload = {
        to: [customerData.phone],
        from: fromNumber,
        content: message
      };

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('Welcome message sent successfully:', response.data?.data?.id);
      return response.data?.data;

    } catch (error) {
      console.error('Failed to send welcome message:', error.response?.data || error.message);
      
      // Don't throw error to avoid breaking the registration flow
      // Just log the error and return null
      return null;
    }
  }

  createWelcomeMessage(customerData) {
    const firstName = customerData.firstName || 'there';
    const companyName = customerData.companyName || 'SiteWorks';
    
    return `Hi ${firstName}! Welcome to ${companyName}! 🎉 

Your account has been successfully created and you're all set to get started.

If you have any questions or need assistance, feel free to reach out to us at (812) 515-1197.

Welcome aboard!
- Team ${companyName}`;
  }

  createPhoneUpdateMessage(customerData, oldPhone, newPhone) {
    const firstName = customerData.firstName || 'there';
    const companyName = customerData.companyName || 'SiteWorks';
    
    return `Hi ${firstName}! 📱

Your phone number has been successfully updated in your ${companyName} account.

Old number: ${oldPhone}
New number: ${newPhone}

You'll now receive all important updates and notifications at your new number.

If you didn't make this change, please contact us immediately at (812) 515-1197.

Best regards,
- Team ${companyName}`;
  }

  async sendPhoneUpdateMessage(customerData, oldPhone, newPhone) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping phone update message');
      return null;
    }

    try {
      const fromNumber = await this.getPhoneNumber();
      if (!fromNumber) {
        console.log('No phone number available for sending messages');
        return null;
      }

      if (!newPhone) {
        console.log('No new phone number provided for update message');
        return null;
      }

      console.log('Sending phone update message to:', newPhone);

      const message = this.createPhoneUpdateMessage(customerData, oldPhone, newPhone);
      
      const payload = {
        to: [newPhone],
        from: fromNumber,
        content: message
      };

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('Phone update message sent successfully:', response.data?.data?.id);
      return response.data?.data;

    } catch (error) {
      console.error('Failed to send phone update message:', error.response?.data || error.message);
      
      // Don't throw error to avoid breaking the profile update flow
      // Just log the error and return null
      return null;
    }
  }

  async sendCustomMessage(toPhone, message) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping custom message');
      return null;
    }

    try {
      const fromNumber = await this.getPhoneNumber();
      if (!fromNumber) {
        console.log('No phone number available for sending messages');
        return null;
      }

      console.log('Sending custom message to:', toPhone);

      const payload = {
        to: [toPhone],
        from: fromNumber,
        content: message
      };

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('Custom message sent successfully:', response.data?.data?.id);
      return response.data?.data;

    } catch (error) {
      console.error('Failed to send custom message:', error.response?.data || error.message);
      return null;
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = OpenPhoneMessageService; 