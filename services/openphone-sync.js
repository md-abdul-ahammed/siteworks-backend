const axios = require('axios');

class OpenPhoneSyncService {
  constructor() {
    this.apiKey = process.env.OPENPHONE_API_KEY;
    this.baseUrl = 'https://api.openphone.com/v1';
    
    if (!this.apiKey) {
      console.warn('OpenPhone API key not found. Contact sync will be disabled.');
    }
  }

  async syncCustomerProfile(customerData) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping contact sync');
      return null;
    }

    try {
      console.log('Syncing customer profile with OpenPhone:', customerData.email);
      
      // First, try to find existing contact by email
      const existingContact = await this.findContactByEmail(customerData.email);
      
      if (existingContact) {
        // Update existing contact
        console.log('Found existing contact, updating:', existingContact.id);
        return await this.updateContact(existingContact.id, customerData);
      } else {
        // Create new contact if not found
        console.log('No existing contact found, creating new one');
        return await this.createContact(customerData);
      }
      
    } catch (error) {
      console.error('Failed to sync customer profile with OpenPhone:', error.response?.data || error.message);
      return null;
    }
  }

  async findContactByEmail(email) {
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
      console.error('Failed to find contact by email:', error.response?.data || error.message);
      return null;
    }
  }

  async createContact(customerData) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const payload = {
        source: "public-api",
        defaultFields: {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          company: customerData.companyName || null
        }
      };

      // Add email if provided
      if (customerData.email) {
        payload.defaultFields.emails = [{
          name: "primary",
          value: customerData.email
        }];
      }

      // Add phone if provided
      if (customerData.phone) {
        payload.defaultFields.phoneNumbers = [{
          name: "primary",
          value: customerData.phone
        }];
      }

      // Add address if provided
      if (customerData.addressLine1 || customerData.city || customerData.postcode) {
        const addressParts = [];
        if (customerData.addressLine1) addressParts.push(customerData.addressLine1);
        if (customerData.addressLine2) addressParts.push(customerData.addressLine2);
        if (customerData.city) addressParts.push(customerData.city);
        if (customerData.state) addressParts.push(customerData.state);
        if (customerData.postcode) addressParts.push(customerData.postcode);
        
        if (addressParts.length > 0) {
          payload.defaultFields.addresses = [{
            name: "primary",
            value: addressParts.join(', ')
          }];
        }
      }

      // Remove null/undefined values
      Object.keys(payload.defaultFields).forEach(key => {
        if (payload.defaultFields[key] === null || payload.defaultFields[key] === undefined || payload.defaultFields[key] === '') {
          delete payload.defaultFields[key];
        }
      });

      const response = await axios.post(`${this.baseUrl}/contacts`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      console.log('OpenPhone contact created successfully:', response.data?.data?.id);
      return response.data?.data;

    } catch (error) {
      console.error('Failed to create OpenPhone contact:', error.response?.data || error.message);
      return null;
    }
  }

  async updateContact(contactId, customerData) {
    if (!this.apiKey) {
      return null;
    }

    try {
      const payload = {
        defaultFields: {}
      };

      // Update first name
      if (customerData.firstName) {
        payload.defaultFields.firstName = customerData.firstName;
      }

      // Update last name
      if (customerData.lastName) {
        payload.defaultFields.lastName = customerData.lastName;
      }

      // Update company
      if (customerData.companyName) {
        payload.defaultFields.company = customerData.companyName;
      }

      // Update email
      if (customerData.email) {
        payload.defaultFields.emails = [{
          name: "primary",
          value: customerData.email
        }];
      }

      // Update phone
      if (customerData.phone) {
        payload.defaultFields.phoneNumbers = [{
          name: "primary",
          value: customerData.phone
        }];
      }

      // Update address if provided
      if (customerData.addressLine1 || customerData.city || customerData.postcode) {
        const addressParts = [];
        if (customerData.addressLine1) addressParts.push(customerData.addressLine1);
        if (customerData.addressLine2) addressParts.push(customerData.addressLine2);
        if (customerData.city) addressParts.push(customerData.city);
        if (customerData.state) addressParts.push(customerData.state);
        if (customerData.postcode) addressParts.push(customerData.postcode);
        
        if (addressParts.length > 0) {
          payload.defaultFields.addresses = [{
            name: "primary",
            value: addressParts.join(', ')
          }];
        }
      }

      // Remove empty fields
      Object.keys(payload.defaultFields).forEach(key => {
        if (payload.defaultFields[key] === null || payload.defaultFields[key] === undefined || payload.defaultFields[key] === '') {
          delete payload.defaultFields[key];
        }
      });

      const response = await axios.patch(`${this.baseUrl}/contacts/${contactId}`, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('OpenPhone contact updated successfully:', contactId);
      return response.data?.data;

    } catch (error) {
      console.error('Failed to update OpenPhone contact:', error.response?.data || error.message);
      return null;
    }
  }

  async syncProfileUpdate(customerId, updatedFields) {
    if (!this.apiKey) {
      console.log('OpenPhone API key not configured, skipping profile sync');
      return null;
    }

    try {
      console.log('Syncing profile update with OpenPhone for customer:', customerId);
      
      // Find contact by customer ID or email
      let contact = null;
      
      if (updatedFields.email) {
        contact = await this.findContactByEmail(updatedFields.email);
      }
      
      if (!contact && updatedFields.openPhoneContactId) {
        // Try to get contact by stored ID
        try {
          const response = await axios.get(`${this.baseUrl}/contacts/${updatedFields.openPhoneContactId}`, {
            headers: {
              'Authorization': this.apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });
          contact = response.data?.data;
        } catch (error) {
          console.log('Could not find contact by stored ID, will create new one');
        }
      }
      
      if (contact) {
        // Update existing contact
        return await this.updateContact(contact.id, updatedFields);
      } else {
        // Create new contact
        return await this.createContact(updatedFields);
      }
      
    } catch (error) {
      console.error('Failed to sync profile update with OpenPhone:', error.response?.data || error.message);
      return null;
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = OpenPhoneSyncService; 