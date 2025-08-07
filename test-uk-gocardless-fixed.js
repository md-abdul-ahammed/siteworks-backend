require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testUKGoCardlessFixed() {
  console.log('🧪 Testing UK GoCardless Integration (Fixed)...\n');

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

    // Test customer creation with UK data
    console.log('Testing UK customer creation...');
    const testCustomerData = {
      email: `test-uk-customer-${Date.now()}@example.com`,
      firstName: 'John',
      lastName: 'Smith',
      companyName: 'Test Company',
      countryOfResidence: 'GB',
      internalId: 'test-uk-internal-id',
      address: {
        line1: '123 High Street',
        line2: 'Suite 100',
        city: 'London',
        postcode: 'SW1A 1AA',
        state: 'England'
      }
    };

    console.log('Creating UK test customer...');
    const customer = await goCardlessService.createCustomer(testCustomerData);
    console.log('✅ UK Customer created successfully');
    console.log('Customer ID:', customer.id);
    console.log('Customer Email:', customer.email);
    console.log('');

    // Test bank account creation with UK bank details
    console.log('Testing UK bank account creation...');
    const bankDetails = {
      accountHolderName: 'John Smith',
      bankCode: '200000',
      accountNumber: '12345678',
      accountType: 'checking',
      countryCode: 'GB',
      internalCustomerId: 'test-uk-internal-id'
    };

    console.log('Creating UK bank account...');
    const bankAccount = await goCardlessService.createCustomerBankAccount(customer.id, bankDetails);
    console.log('✅ UK Bank account created successfully');
    console.log('Bank Account ID:', bankAccount.id);
    console.log('');

    // Test mandate creation for UK
    console.log('Testing UK mandate creation...');
    const mandateData = {
      scheme: 'bacs',
      internalCustomerId: 'test-uk-internal-id'
    };

    console.log('Creating UK mandate...');
    const mandate = await goCardlessService.createMandate(bankAccount.id, mandateData);
    console.log('✅ UK Mandate created successfully');
    console.log('Mandate ID:', mandate.id);
    console.log('Mandate Status:', mandate.status);
    console.log('');

    console.log('🎉 All UK GoCardless tests passed!');
    console.log('Customer ID:', customer.id);
    console.log('Bank Account ID:', bankAccount.id);
    console.log('Mandate ID:', mandate.id);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

testUKGoCardlessFixed(); 