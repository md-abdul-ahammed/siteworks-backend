require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testUSGoCardless() {
  console.log('🧪 Testing USA GoCardless Integration...\n');

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

    // Test customer creation with US data
    console.log('Testing US customer creation...');
    const testCustomerData = {
      email: `test-us-customer-${Date.now()}@example.com`,
      firstName: 'John',
      lastName: 'Doe',
      companyName: 'Test Corp',
      // phone: '+1234567890', // Optional field
      countryOfResidence: 'US',
      internalId: 'test-us-internal-id',
      address: {
        line1: '123 Main Street',
        line2: 'Suite 100',
        city: 'New York',
        postcode: '10001',
        state: 'NY'
      }
    };

    console.log('Creating US test customer...');
    const customer = await goCardlessService.createCustomer(testCustomerData);
    console.log('✅ US Customer created successfully');
    console.log('Customer ID:', customer.id);
    console.log('Customer Email:', customer.email);
    console.log('');

    // Test bank account creation with US bank details
    console.log('Testing US bank account creation...');
    const bankDetails = {
      accountHolderName: 'John Doe',
      bankCode: '021000021', // JPMorgan Chase routing number
      accountNumber: '1234567890',
      accountType: 'checking',
      countryCode: 'US',
      internalCustomerId: 'test-us-internal-id'
    };

    console.log('Creating US bank account...');
    const bankAccount = await goCardlessService.createCustomerBankAccount(customer.id, bankDetails);
    console.log('✅ US Bank account created successfully');
    console.log('Bank Account ID:', bankAccount.id);
    console.log('');

    // Test mandate creation for US
    console.log('Testing US mandate creation...');
    const mandateData = {
      scheme: 'ach',
      internalCustomerId: 'test-us-internal-id'
    };

    console.log('Creating US mandate...');
    const mandate = await goCardlessService.createMandate(bankAccount.id, mandateData);
    console.log('✅ US Mandate created successfully');
    console.log('Mandate ID:', mandate.id);
    console.log('Mandate Status:', mandate.status);
    console.log('');

    console.log('🎉 All US GoCardless tests passed!');
    console.log('Customer ID:', customer.id);
    console.log('Bank Account ID:', bankAccount.id);
    console.log('Mandate ID:', mandate.id);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testUSGoCardless(); 