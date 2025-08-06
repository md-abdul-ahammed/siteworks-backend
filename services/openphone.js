const axios = require('axios');

class OpenPhoneService {
  constructor() {
    this.apiKey = process.env.OPENPHONE_API_KEY;
    this.baseUrl = 'https://api.openphone.com/v1';
    
    if (!this.apiKey) {
      console.warn('OpenPhone API key not found. OpenPhone integration will be disabled.');
    }
  }

  /**
   * Create a contact in OpenPhone
   * @param {Object} contactData - Contact data
   * @param {string} contactData.firstName - First name
   * @param {string} contactData.lastName - Last name
   * @param {string} contactData.email - Email address
   * @param {string} contactData.phone - Phone number
   * @param {string} contactData.companyName - Company name (optional)
   * @param {string} contactData.notes - Additional notes (optional)
   * @returns {Promise<Object>} Created contact data
   */
  async createContact(contactData) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping contact creation');
      return null;
    }

    try {
      console.log('Creating OpenPhone contact for:', contactData.email);
      
      const payload = {
        source: "public-api",
        defaultFields: {
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          company: contactData.companyName || null
        }
      };

      // Add email if provided
      if (contactData.email) {
        payload.defaultFields.emails = [{
          name: "primary",
          value: contactData.email
        }];
      }

      // Add phone if provided
      if (contactData.phone) {
        payload.defaultFields.phoneNumbers = [{
          name: "primary",
          value: contactData.phone
        }];
      }

      // Remove null/undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key] === null || payload[key] === undefined || payload[key] === '') {
          delete payload[key];
        }
      });

      const response = await axios.post(`${this.baseUrl}/contacts`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('OpenPhone contact created successfully:', response.data?.data?.id);
      return response.data?.data;

    } catch (error) {
      console.error('Failed to create OpenPhone contact:', error.response?.data || error.message);
      
      // Don't throw error to avoid breaking the registration flow
      // Just log the error and return null
      return null;
    }
  }

  /**
   * Update an existing contact in OpenPhone
   * @param {string} contactId - OpenPhone contact ID
   * @param {Object} contactData - Updated contact data
   * @returns {Promise<Object>} Updated contact data
   */
  async updateContact(contactId, contactData) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping contact update');
      return null;
    }

    try {
      console.log('Updating OpenPhone contact:', contactId);
      
      const payload = {
        source: "public-api",
        defaultFields: {
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          company: contactData.companyName || null
        }
      };

      // Add email if provided
      if (contactData.email) {
        payload.defaultFields.emails = [{
          name: "primary",
          value: contactData.email
        }];
      }

      // Add phone if provided
      if (contactData.phone) {
        payload.defaultFields.phoneNumbers = [{
          name: "primary",
          value: contactData.phone
        }];
      }

      // Remove null/undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key] === null || payload[key] === undefined || payload[key] === '') {
          delete payload[key];
        }
      });

      const response = await axios.put(`${this.baseUrl}/contacts/${contactId}`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('OpenPhone contact updated successfully');
      return response.data?.data;

    } catch (error) {
      console.error('Failed to update OpenPhone contact:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get a contact by email
   * @param {string} email - Email address to search for
   * @returns {Promise<Object|null>} Contact data or null if not found
   */
  async getContactByEmail(email) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/contacts`, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          email: email
        },
        timeout: 10000
      });

      if (response.data?.data && response.data.data.length > 0) {
        return response.data.data[0];
      }

      return null;

    } catch (error) {
      console.error('Failed to get OpenPhone contact by email:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Delete a contact from OpenPhone
   * @param {string} contactId - OpenPhone contact ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteContact(contactId) {
    if (!this.apiKey) {
      return false;
    }

    try {
      await axios.delete(`${this.baseUrl}/contacts/${contactId}`, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('OpenPhone contact deleted successfully');
      return true;

    } catch (error) {
      console.error('Failed to delete OpenPhone contact:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Check if OpenPhone integration is configured
   * @returns {boolean} True if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = OpenPhoneService; 