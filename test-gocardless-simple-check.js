require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testGoCardlessSimple() {
  console.log('🧪 Testing GoCardless Service Simple Check...\n');

  try {
    // Check environment variables
    console.log('Environment Check:');
    console.log('GOCARDLESS_ACCESS_TOKEN:', process.env.GOCARDLESS_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('GOCARDLESS_ENVIRONMENT:', process.env.GOCARDLESS_ENVIRONMENT || 'sandbox (default)');
    console.log('');

    if (!process.env.GOCARDLESS_ACCESS_TOKEN) {
      console.log('❌ ERROR: GoCardless access token not configured!');
      return;
    }

    // Initialize GoCardless service
    console.log('Initializing GoCardless service...');
    const goCardlessService = new GoCardlessService();
    console.log('✅ GoCardless service initialized\n');

    // Test customer creation
    console.log('Testing customer creation...');
    const testCustomerData = {
      email: `test-customer-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'Customer',
      companyName: 'Test Company',
      // phone: '44123456789', // Optional field
      countryOfResidence: 'GB',
      internalId: 'test-internal-id',
      address: {
        line1: '123 Test Street',
        line2: 'Suite 100',
        city: 'London',
        postcode: 'SW1A 1AA',
        state: 'England'
      }
    };

    console.log('Creating test customer...');
    const customer = await goCardlessService.createCustomer(testCustomerData);
    console.log('✅ Customer created successfully');
    console.log('Customer ID:', customer.id);
    console.log('Customer Email:', customer.email);
    console.log('');

    // Test bank account creation
    console.log('Testing bank account creation...');
    const bankDetails = {
      accountHolderName: 'Test Customer',
      bankCode: '200000',
      accountNumber: '55779911',
      accountType: 'checking',
      countryCode: 'GB',
      internalCustomerId: 'test-internal-id'
    };

    console.log('Creating bank account...');
    const bankAccount = await goCardlessService.createCustomerBankAccount(customer.id, bankDetails);
    console.log('✅ Bank account created successfully');
    console.log('Bank Account ID:', bankAccount.id);
    console.log('');

    // Test mandate creation
    console.log('Testing mandate creation...');
    const mandateData = {
      scheme: 'bacs',
      internalCustomerId: 'test-internal-id'
    };

    console.log('Creating mandate...');
    const mandate = await goCardlessService.createMandate(bankAccount.id, mandateData);
    console.log('✅ Mandate created successfully');
    console.log('Mandate ID:', mandate.id);
    console.log('Mandate Status:', mandate.status);
    console.log('');

    console.log('🎉 All GoCardless tests passed!');
    console.log('Customer ID:', customer.id);
    console.log('Bank Account ID:', bankAccount.id);
    console.log('Mandate ID:', mandate.id);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testGoCardlessSimple(); 