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
        country_code: customerData.countryOfResidence,
        address_line1: customerData.address.line1,
        address_line2: customerData.address.addressLine2 || undefined,
        city: customerData.address.city,
        postal_code: customerData.address.postcode,
        region: customerData.address.state || undefined,
        language: 'en', // Default to English
        metadata: {
          internal_customer_id: customerData.internalId || '',
          source: 'website_registration'
        }
      };

      // Only add phone_number if it's provided and valid
      if (customerData.phone && customerData.phone.trim()) {
        customerPayload.phone_number = customerData.phone;
      }

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
        account_type: bankDetails.accountType,
        country_code: bankDetails.countryCode,
        currency: this.getCurrencyForCountry(bankDetails.countryCode),
        links: {
          customer: goCardlessCustomerId
        },
        metadata: {
          internal_customer_id: bankDetails.internalCustomerId || '',
          source: 'website_registration'
        }
      };

      // Add country-specific fields
      if (bankDetails.countryCode === 'GB') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'GB');
        bankAccountPayload.branch_code = bankDetails.bankCode.substring(0, 6);
        // Remove account_type for UK as it's not required
        delete bankAccountPayload.account_type;
      } else if (bankDetails.countryCode === 'US') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'US');
      } else if (bankDetails.countryCode === 'CA') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'CA');
      } else if (bankDetails.countryCode === 'AU') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'AU');
      } else if (bankDetails.countryCode === 'NZ') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'NZ');
      } else if (bankDetails.countryCode === 'SE') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'SE');
      } else if (bankDetails.countryCode === 'NO') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'NO');
      } else if (bankDetails.countryCode === 'DK') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'DK');
      } else if (bankDetails.countryCode === 'FI') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'FI');
      } else if (bankDetails.countryCode === 'DE') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'DE');
      } else if (bankDetails.countryCode === 'AT') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'AT');
      } else if (bankDetails.countryCode === 'BE') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'BE');
      } else if (bankDetails.countryCode === 'NL') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'NL');
      } else if (bankDetails.countryCode === 'FR') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'FR');
      } else if (bankDetails.countryCode === 'ES') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'ES');
      } else if (bankDetails.countryCode === 'IT') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'IT');
      } else if (bankDetails.countryCode === 'IE') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'IE');
      } else if (bankDetails.countryCode === 'PL') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'PL');
      } else if (bankDetails.countryCode === 'CZ') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'CZ');
      } else if (bankDetails.countryCode === 'HU') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'HU');
      } else if (bankDetails.countryCode === 'PT') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'PT');
      } else if (bankDetails.countryCode === 'GR') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'GR');
      } else if (bankDetails.countryCode === 'HR') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'HR');
      } else if (bankDetails.countryCode === 'SI') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'SI');
      } else if (bankDetails.countryCode === 'SK') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'SK');
      } else if (bankDetails.countryCode === 'EE') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'EE');
      } else if (bankDetails.countryCode === 'LV') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'LV');
      } else if (bankDetails.countryCode === 'LT') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'LT');
      } else if (bankDetails.countryCode === 'LU') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'LU');
      } else if (bankDetails.countryCode === 'MT') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'MT');
      } else if (bankDetails.countryCode === 'CY') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'CY');
      } else if (bankDetails.countryCode === 'BG') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'BG');
      } else if (bankDetails.countryCode === 'RO') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'RO');
      } else if (bankDetails.countryCode === 'IS') {
        bankAccountPayload.bank_code = this.formatBankCode(bankDetails.bankCode, 'IS');
      }

      console.log('Creating GoCardless bank account with payload:', {
        ...bankAccountPayload,
        account_number: '[HIDDEN]'
      });

      const bankAccount = await this.client.customerBankAccounts.create(
        bankAccountPayload,
        idempotencyKey
      );

      console.log('GoCardless bank account created successfully:', bankAccount.id);
      return bankAccount;

    } catch (error) {
      console.error('Error creating GoCardless bank account:', error);
      throw new Error(`Failed to create GoCardless bank account: ${error.message}`);
    }
  }

  /**
   * Create a mandate for a customer bank account
   * @param {string} customerBankAccountId - GoCardless customer bank account ID
   * @param {Object} mandateData - Mandate data
   * @param {string} mandateData.scheme - Payment scheme (e.g., 'bacs', 'sepa_core', 'ach')
   * @param {string} mandateData.countryCode - Country code to determine scheme
   * @param {string} mandateData.metadata - Additional metadata
   * @returns {Promise<Object>} GoCardless mandate object
   */
  async createMandate(customerBankAccountId, mandateData = {}) {
    try {
      const idempotencyKey = uuidv4();
      
      // Determine scheme based on country code if not explicitly provided
      let scheme = mandateData.scheme;
      if (!scheme && mandateData.countryCode) {
        scheme = this.getSchemeForCountry(mandateData.countryCode);
      } else if (!scheme) {
        scheme = 'bacs'; // Default to BACS for UK
      }
      
      const mandatePayload = {
        scheme: scheme,
        links: {
          customer_bank_account: customerBankAccountId
        },
        metadata: {
          internal_customer_id: mandateData.internalCustomerId || '',
          source: 'website_registration',
          ...mandateData.metadata
        }
      };

      // Add payer_ip_address for ACH mandates
      if (scheme === 'ach') {
        mandatePayload.payer_ip_address = mandateData.payerIpAddress || '8.8.8.8';
      }

      console.log('Creating GoCardless mandate with payload:', {
        ...mandatePayload,
        scheme: scheme,
        countryCode: mandateData.countryCode
      });

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
   * Create a payment for a mandate
   * @param {string} mandateId - GoCardless mandate ID
   * @param {Object} paymentData - Payment data
   * @param {number} paymentData.amount - Payment amount in pence/cents
   * @param {string} paymentData.currency - Currency code (e.g., 'GBP', 'USD', 'EUR')
   * @param {string} paymentData.description - Payment description
   * @param {string} paymentData.reference - Payment reference
   * @param {Date} paymentData.chargeDate - Charge date
   * @returns {Promise<Object>} GoCardless payment object
   */
  async createPayment(mandateId, paymentData) {
    try {
      const idempotencyKey = uuidv4();
      
      // Get mandate to check the currency and scheme
      const mandate = await this.getMandate(mandateId);
      
      // Determine currency based on mandate scheme
      let currency = paymentData.currency || 'GBP';
      if (mandate.scheme === 'ach') {
        currency = 'USD';
      } else if (mandate.scheme === 'bacs') {
        currency = 'GBP';
      } else if (mandate.scheme === 'sepa_core') {
        currency = 'EUR';
      }
      
      // Create a shorter reference (max 10 characters)
      const shortReference = paymentData.reference ? 
        paymentData.reference.substring(0, 10) : 
        `INV${Date.now().toString().slice(-6)}`;
      
      const paymentPayload = {
        amount: paymentData.amount, // Amount in pence/cents
        currency: currency,
        description: paymentData.description,
        reference: shortReference,
        charge_date: paymentData.chargeDate.toISOString().split('T')[0], // YYYY-MM-DD format
        links: {
          mandate: mandateId
        },
        metadata: {
          internal_customer_id: paymentData.internalCustomerId || '',
          invoice_id: paymentData.invoiceId || '',
          source: 'website_payment'
        }
      };

      console.log('Creating GoCardless payment with payload:', {
        ...paymentPayload,
        amount: `${paymentPayload.amount} ${paymentPayload.currency}`
      });

      const payment = await this.client.payments.create(
        paymentPayload,
        idempotencyKey
      );

      console.log('GoCardless payment created successfully:', payment.id);
      return payment;

    } catch (error) {
      console.error('Error creating GoCardless payment:', error);
      throw new Error(`Failed to create GoCardless payment: ${error.message}`);
    }
  }

  /**
   * Get payment by ID
   * @param {string} paymentId - GoCardless payment ID
   * @returns {Promise<Object>} GoCardless payment object
   */
  async getPayment(paymentId) {
    try {
      const payment = await this.client.payments.get(paymentId);
      return payment;
    } catch (error) {
      console.error('Error getting GoCardless payment:', error);
      throw new Error(`Failed to get GoCardless payment: ${error.message}`);
    }
  }

  /**
   * List payments for a mandate
   * @param {string} mandateId - GoCardless mandate ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of GoCardless payment objects
   */
  async listPayments(mandateId, options = {}) {
    try {
      const payments = await this.client.payments.list({
        mandate: mandateId,
        ...options
      });
      return payments;
    } catch (error) {
      console.error('Error listing GoCardless payments:', error);
      throw new Error(`Failed to list GoCardless payments: ${error.message}`);
    }
  }

  /**
   * Process webhook events
   * @param {Object} webhookData - Webhook data from GoCardless
   * @returns {Promise<Object>} Processed webhook result
   */
  async processWebhook(webhookData) {
    try {
      const events = webhookData.events || [];
      const processedEvents = [];

      for (const event of events) {
        const processedEvent = {
          id: event.id,
          resource_type: event.resource_type,
          action: event.action,
          resource_id: event.links?.payment || event.links?.mandate || event.links?.customer,
          created_at: event.created_at,
          details: event.details
        };

        // Handle payment events
        if (event.resource_type === 'payments') {
          switch (event.action) {
            case 'confirmed':
              processedEvent.status = 'paid';
              processedEvent.message = 'Payment confirmed successfully';
              break;
            case 'failed':
              processedEvent.status = 'failed';
              processedEvent.message = 'Payment failed';
              break;
            case 'cancelled':
              processedEvent.status = 'cancelled';
              processedEvent.message = 'Payment cancelled';
              break;
            case 'charged_back':
              processedEvent.status = 'charged_back';
              processedEvent.message = 'Payment charged back';
              break;
            default:
              processedEvent.status = 'unknown';
              processedEvent.message = `Payment ${event.action}`;
          }
        }

        // Handle mandate events
        if (event.resource_type === 'mandates') {
          switch (event.action) {
            case 'active':
              processedEvent.status = 'active';
              processedEvent.message = 'Mandate activated successfully';
              break;
            case 'failed':
              processedEvent.status = 'failed';
              processedEvent.message = 'Mandate failed';
              break;
            case 'cancelled':
              processedEvent.status = 'cancelled';
              processedEvent.message = 'Mandate cancelled';
              break;
            default:
              processedEvent.status = 'unknown';
              processedEvent.message = `Mandate ${event.action}`;
          }
        }

        processedEvents.push(processedEvent);
      }

      return {
        success: true,
        events: processedEvents
      };

    } catch (error) {
      console.error('Error processing GoCardless webhook:', error);
      throw new Error(`Failed to process GoCardless webhook: ${error.message}`);
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