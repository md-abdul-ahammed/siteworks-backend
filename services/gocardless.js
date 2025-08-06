const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');
const { v4: uuidv4 } = require('uuid');

/**
 * GoCardless Service
 * Handles customer and mandate creation for direct debit payments
 */
class GoCardlessService {
  constructor() {
    // Initialize GoCardless client
    this.client = gocardless(
      process.env.GOCARDLESS_ACCESS_TOKEN,
      process.env.GOCARDLESS_ENVIRONMENT === 'live' 
        ? constants.Environments.Live 
        : constants.Environments.Sandbox,
      { 
        raiseOnIdempotencyConflict: false // Handle conflicts gracefully
      }
    );
  }

  /**
   * Create a GoCardless customer
   * @param {Object} customerData - Customer information
   * @param {string} customerData.email - Customer email
   * @param {string} customerData.firstName - Customer first name
   * @param {string} customerData.lastName - Customer last name
   * @param {string} customerData.companyName - Company name (optional)
   * @param {string} customerData.phone - Phone number (optional)
   * @param {string} customerData.countryOfResidence - Country code (e.g., 'GB')
   * @param {Object} customerData.address - Address object
   * @param {string} customerData.address.line1 - Address line 1
   * @param {string} customerData.address.line2 - Address line 2 (optional)
   * @param {string} customerData.address.city - City
   * @param {string} customerData.address.postcode - Postcode
   * @param {string} customerData.address.state - State (optional)
   * @returns {Promise<Object>} GoCardless customer object
   */
  async createCustomer(customerData) {
    try {
      const idempotencyKey = uuidv4();
      
      const customerPayload = {
        email: customerData.email,
        given_name: customerData.firstName,
        family_name: customerData.lastName,
        company_name: customerData.companyName || undefined,
        phone_number: customerData.phone || undefined,
        country_code: customerData.countryOfResidence,
        address_line1: customerData.address.line1,
        address_line2: customerData.address.line2 || undefined,
        city: customerData.address.city,
        postal_code: customerData.address.postcode,
        region: customerData.address.state || undefined,
        language: 'en', // Default to English
        metadata: {
          internal_customer_id: customerData.internalId || '',
          source: 'website_registration'
        }
      };

      console.log('Creating GoCardless customer with payload:', {
        ...customerPayload,
        metadata: customerPayload.metadata
      });

      const customer = await this.client.customers.create(
        customerPayload,
        idempotencyKey
      );

      console.log('GoCardless customer created successfully:', customer.id);
      return customer;

    } catch (error) {
      console.error('Error creating GoCardless customer:', error);
      throw new Error(`Failed to create GoCardless customer: ${error.message}`);
    }
  }

  /**
   * Create a Customer Bank Account with actual bank details
   * @param {string} goCardlessCustomerId - GoCardless customer ID
   * @param {Object} bankDetails - Bank account information
   * @param {string} bankDetails.accountHolderName - Account holder name
   * @param {string} bankDetails.bankCode - Bank code (sort code for UK, routing number for US, etc.)
   * @param {string} bankDetails.accountNumber - Account number
   * @param {string} bankDetails.accountType - Account type ('checking' or 'savings')
   * @param {string} bankDetails.countryCode - Country code (e.g., 'GB', 'US', 'CA', etc.)
   * @returns {Promise<Object>} GoCardless customer bank account object
   */
  async createCustomerBankAccount(goCardlessCustomerId, bankDetails) {
    try {
      const idempotencyKey = uuidv4();
      
      // Base payload with common fields
      const bankAccountPayload = {
        account_holder_name: bankDetails.accountHolderName,
        account_number: bankDetails.accountNumber,
        country_code: bankDetails.countryCode,
        currency: this.getCurrencyForCountry(bankDetails.countryCode),
        account_type: bankDetails.accountType || 'checking',
        links: {
          customer: goCardlessCustomerId
        },
        metadata: {
          source: 'website_registration'
        }
      };

      // Handle country-specific requirements
      // Countries that use bank_code (routing number)
      const bankCodeCountries = ['US'];
      
      // Countries that use branch_code (sort code)
      const branchCodeCountries = ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'LU', 'SE', 'DK', 'NO', 'CA', 'AU', 'NZ'];
      
      if (bankCodeCountries.includes(bankDetails.countryCode)) {
        // For countries that use bank_code (routing number)
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, bankDetails.countryCode);
      } else if (branchCodeCountries.includes(bankDetails.countryCode)) {
        // For countries that use branch_code (sort code)
        bankAccountPayload.branch_code = this.formatBankCode(bankDetails.bankCode, bankDetails.countryCode);
      } else {
        // For other countries, try branch_code as default
        bankAccountPayload.branch_code = this.formatBankCode(bankDetails.bankCode, bankDetails.countryCode);
      }

      console.log('Creating GoCardless customer bank account with payload:', {
        ...bankAccountPayload,
        account_number: '****' + bankAccountPayload.account_number.slice(-4), // Mask for logging
        bank_code: bankAccountPayload.bank_code,
        branch_code: bankAccountPayload.branch_code
      });

      const customerBankAccount = await this.client.customerBankAccounts.create(
        bankAccountPayload,
        idempotencyKey
      );

      console.log('GoCardless customer bank account created successfully:', customerBankAccount.id);
      return customerBankAccount;

    } catch (error) {
      console.error('Error creating GoCardless customer bank account:', error);
      throw new Error(`Failed to create GoCardless customer bank account: ${error.message}`);
    }
  }

  /**
   * Create a GoCardless mandate for a customer bank account
   * @param {string} customerBankAccountId - GoCardless customer bank account ID
   * @param {Object} mandateData - Mandate information
   * @param {string} mandateData.scheme - Payment scheme ('bacs', 'ach', 'sepa_core', etc.)
   * @param {string} mandateData.countryCode - Country code for determining scheme
   * @param {string} mandateData.payerIpAddress - Payer IP address (required for ACH scheme)
   * @returns {Promise<Object>} GoCardless mandate object
   */
  async createMandate(customerBankAccountId, mandateData = {}) {
    try {
      const idempotencyKey = uuidv4();
      
      // Determine scheme based on country code or use provided scheme
      const scheme = mandateData.scheme || (mandateData.countryCode ? this.getSchemeForCountry(mandateData.countryCode) : 'bacs');
      
      const mandatePayload = {
        links: {
          customer_bank_account: customerBankAccountId
        },
        scheme: scheme,
        metadata: {
          source: 'website_registration',
          created_via: 'api'
        }
      };

      // Add payer_ip_address for ACH scheme (required by GoCardless)
      if (scheme === 'ach') {
        let payerIp = mandateData.payerIpAddress || '8.8.8.8';
        
        // Validate and fix IP address
        if (payerIp === '::1' || payerIp === 'localhost' || payerIp === '127.0.0.1' || !payerIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          payerIp = '8.8.8.8'; // Use Google DNS IP as fallback
        }
        
        mandatePayload.payer_ip_address = payerIp;
      }

      console.log('Creating GoCardless mandate with payload:', mandatePayload);

      const mandate = await this.client.mandates.create(
        mandatePayload,
        idempotencyKey
      );

      console.log('GoCardless mandate created successfully:', mandate.id);
      return mandate;

    } catch (error) {
      console.error('Error creating GoCardless mandate:', error);
      throw new Error(`Failed to create GoCardless mandate: ${error.message}`);
    }
  }

  /**
   * Format bank code for specific country requirements
   * @param {string} bankCode - Original bank code
   * @param {string} countryCode - Country code
   * @returns {string} Formatted bank code
   */
  formatBankCode(bankCode, countryCode) {
    // For Canada, we need to extract the first 3-4 digits for branch_code
    if (countryCode === 'CA') {
      // Canadian bank codes are typically 9 digits, we need first 3-4 for branch_code
      return bankCode.substring(0, 4);
    }
    
    // For Australia, we need to extract the first 3-4 digits for branch_code
    if (countryCode === 'AU') {
      // Australian bank codes are typically 6 digits, we need first 3-4 for branch_code
      return bankCode.substring(0, 4);
    }
    
    // For US, keep the full routing number (9 digits)
    if (countryCode === 'US') {
      return bankCode;
    }
    
    // For UK and other European countries, keep as is (usually 6 digits)
    if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'LU', 'SE', 'DK', 'NO'].includes(countryCode)) {
      return bankCode;
    }
    
    // For other countries, try to format to 3-4 digits
    if (bankCode.length > 4) {
      return bankCode.substring(0, 4);
    }
    
    return bankCode;
  }

  /**
   * Get currency for a country code
   * @param {string} countryCode - ISO country code
   * @returns {string} Currency code
   */
  getCurrencyForCountry(countryCode) {
    const currencyMap = {
      'GB': 'GBP',
      'US': 'USD',
      'DE': 'EUR',
      'FR': 'EUR',
      'IT': 'EUR',
      'ES': 'EUR',
      'NL': 'EUR',
      'BE': 'EUR',
      'AT': 'EUR',
      'IE': 'EUR',
      'PT': 'EUR',
      'FI': 'EUR',
      'LU': 'EUR',
      'SE': 'SEK',
      'DK': 'DKK',
      'NO': 'NOK',
      'AU': 'AUD',
      'CA': 'CAD',
      'NZ': 'NZD'
    };
    
    return currencyMap[countryCode] || 'GBP'; // Default to GBP
  }

  /**
   * Get payment scheme for a country code
   * @param {string} countryCode - ISO country code
   * @returns {string} Payment scheme
   */
  getSchemeForCountry(countryCode) {
    const schemeMap = {
      'GB': 'bacs',
      'US': 'ach',
      'CA': 'ach', // Canada uses ACH
      'AU': 'ach', // Australia uses ACH
      'NZ': 'ach', // New Zealand uses ACH
      'DE': 'sepa_core',
      'FR': 'sepa_core',
      'IT': 'sepa_core',
      'ES': 'sepa_core',
      'NL': 'sepa_core',
      'BE': 'sepa_core',
      'AT': 'sepa_core',
      'IE': 'sepa_core',
      'PT': 'sepa_core',
      'FI': 'sepa_core',
      'LU': 'sepa_core',
      'SE': 'sepa_core',
      'DK': 'sepa_core',
      'NO': 'sepa_core'
    };
    
    return schemeMap[countryCode] || 'bacs'; // Default to BACS
  }

  /**
   * Get customer details from GoCardless
   * @param {string} customerId - GoCardless customer ID
   * @returns {Promise<Object>} Customer details
   */
  async getCustomer(customerId) {
    try {
      const customer = await this.client.customers.find(customerId);
      return customer;
    } catch (error) {
      console.error('Error fetching GoCardless customer:', error);
      throw new Error(`Failed to fetch GoCardless customer: ${error.message}`);
    }
  }

  /**
   * Get mandate details from GoCardless
   * @param {string} mandateId - GoCardless mandate ID
   * @returns {Promise<Object>} Mandate details
   */
  async getMandate(mandateId) {
    try {
      const mandate = await this.client.mandates.find(mandateId);
      return mandate;
    } catch (error) {
      console.error('Error fetching GoCardless mandate:', error);
      throw new Error(`Failed to fetch GoCardless mandate: ${error.message}`);
    }
  }

  /**
   * List all customers (with pagination)
   * @param {Object} options - List options
   * @param {number} options.limit - Number of records to return (max 500)
   * @param {string} options.after - Cursor for pagination
   * @returns {Promise<Object>} List of customers
   */
  async listCustomers(options = {}) {
    try {
      const customers = await this.client.customers.list({
        limit: options.limit || 50,
        after: options.after || undefined
      });
      return customers;
    } catch (error) {
      console.error('Error listing GoCardless customers:', error);
      throw new Error(`Failed to list GoCardless customers: ${error.message}`);
    }
  }

  /**
   * List mandates for a customer
   * @param {string} customerId - GoCardless customer ID
   * @param {Object} options - List options
   * @returns {Promise<Object>} List of mandates
   */
  async listMandates(customerId, options = {}) {
    try {
      const mandates = await this.client.mandates.list({
        customer: customerId,
        limit: options.limit || 50,
        after: options.after || undefined
      });
      return mandates;
    } catch (error) {
      console.error('Error listing GoCardless mandates:', error);
      throw new Error(`Failed to list GoCardless mandates: ${error.message}`);
    }
  }

  /**
   * Update a GoCardless customer
   * @param {string} customerId - GoCardless customer ID
   * @param {Object} customerData - Updated customer information
   * @param {string} customerData.email - Customer email
   * @param {string} customerData.firstName - Customer first name
   * @param {string} customerData.lastName - Customer last name
   * @param {string} customerData.companyName - Company name (optional)
   * @param {string} customerData.phone - Phone number (optional)
   * @param {string} customerData.countryOfResidence - Country code (e.g., 'GB')
   * @param {Object} customerData.address - Address object
   * @param {string} customerData.address.line1 - Address line 1
   * @param {string} customerData.address.line2 - Address line 2 (optional)
   * @param {string} customerData.address.city - City
   * @param {string} customerData.address.postcode - Postcode
   * @param {string} customerData.address.state - State (optional)
   * @returns {Promise<Object>} Updated GoCardless customer object
   */
  async updateCustomer(customerId, customerData) {
    try {
      const updatePayload = {
        email: customerData.email,
        given_name: customerData.firstName,
        family_name: customerData.lastName,
        company_name: customerData.companyName || undefined,
        phone_number: customerData.phone || undefined,
        country_code: customerData.countryOfResidence,
        address_line1: customerData.address.line1,
        address_line2: customerData.address.line2 || undefined,
        city: customerData.address.city,
        postal_code: customerData.address.postcode,
        region: customerData.address.state || undefined,
        language: 'en' // Default to English
      };

      console.log('Updating GoCardless customer with payload:', updatePayload);

      const customer = await this.client.customers.update(customerId, updatePayload);

      console.log('GoCardless customer updated successfully:', customer.id);
      return customer;

    } catch (error) {
      console.error('Error updating GoCardless customer:', error);
      throw new Error(`Failed to update GoCardless customer: ${error.message}`);
    }
  }
}

module.exports = GoCardlessService;