require('dotenv').config();
const GoCardlessService = require('./services/gocardless');

async function testGoCardlessIntegration() {
  console.log('🧪 Testing GoCardless Integration (Fixed Version)');
  console.log('================================================');
  
  const goCardlessService = new GoCardlessService();
  
  // Test data for different countries
  const testCases = [
    {
      name: 'US Customer (ACH)',
      customerData: {
        email: 'test-us@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'US Company',
        phone: '+12345678901',
        countryOfResidence: 'US',
        address: {
          line1: '123 Main St',
          line2: 'Apt 4B',
          city: 'New York',
          postcode: '10001',
          state: 'NY'
        },
        internalId: 'test-us-001'
      },
      bankDetails: {
        accountHolderName: 'John Doe',
        bankCode: '021000021', // Chase Bank routing number
        accountNumber: '123456789',
        accountType: 'checking',
        countryCode: 'US',
        internalCustomerId: 'test-us-001'
      }
    },
    {
      name: 'UK Customer (BACS)',
      customerData: {
        email: 'test-uk@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        companyName: 'UK Company',
        phone: '+441234567890',
        countryOfResidence: 'GB',
        address: {
          line1: '456 High Street',
          line2: 'Suite 2',
          city: 'London',
          postcode: 'SW1A 1AA',
          state: ''
        },
        internalId: 'test-uk-001'
      },
      bankDetails: {
        accountHolderName: 'Jane Smith',
        bankCode: '123456', // Sort code
        accountNumber: '12345678',
        accountType: 'checking',
        countryCode: 'GB',
        internalCustomerId: 'test-uk-001'
      }
    },
    {
      name: 'CA Customer (ACH)',
      customerData: {
        email: 'test-ca@example.com',
        firstName: 'Bob',
        lastName: 'Wilson',
        companyName: 'CA Company',
        phone: '+141612345678',
        countryOfResidence: 'CA',
        address: {
          line1: '789 Queen St',
          line2: 'Unit 5',
          city: 'Toronto',
          postcode: 'M5V 2K7',
          state: 'ON'
        },
        internalId: 'test-ca-001'
      },
      bankDetails: {
        accountHolderName: 'Bob Wilson',
        bankCode: '003600000', // Bank code
        accountNumber: '123456789',
        accountType: 'checking',
        countryCode: 'CA',
        internalCustomerId: 'test-ca-001'
      }
    },
    {
      name: 'DE Customer (SEPA)',
      customerData: {
        email: 'test-de@example.com',
        firstName: 'Hans',
        lastName: 'Mueller',
        companyName: 'DE Company',
        phone: '+491234567890',
        countryOfResidence: 'DE',
        address: {
          line1: '123 Hauptstraße',
          line2: 'Etage 3',
          city: 'Berlin',
          postcode: '10115',
          state: ''
        },
        internalId: 'test-de-001'
      },
      bankDetails: {
        accountHolderName: 'Hans Mueller',
        bankCode: '10000000', // Bankleitzahl
        accountNumber: '1234567890',
        accountType: 'checking',
        countryCode: 'DE',
        internalCustomerId: 'test-de-001'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('----------------------------------------');
    
    try {
      // Test 1: Create Customer
      console.log('1️⃣ Creating customer...');
      const customer = await goCardlessService.createCustomer(testCase.customerData);
      console.log('✅ Customer created:', customer.id);
      
      // Test 2: Create Bank Account
      console.log('2️⃣ Creating bank account...');
      const bankAccount = await goCardlessService.createCustomerBankAccount(
        customer.id,
        testCase.bankDetails
      );
      console.log('✅ Bank account created:', bankAccount.id);
      console.log('   Currency:', bankAccount.currency);
      console.log('   Country:', bankAccount.country_code);
      
      // Test 3: Create Mandate
      console.log('3️⃣ Creating mandate...');
      const mandate = await goCardlessService.createMandate(
        bankAccount.id,
        {
          countryCode: testCase.customerData.countryOfResidence,
          internalCustomerId: testCase.customerData.internalId,
          payerIpAddress: '8.8.8.8'
        }
      );
      console.log('✅ Mandate created:', mandate.id);
      console.log('   Scheme:', mandate.scheme);
      console.log('   Status:', mandate.status);
      
      // Test 4: Create a test payment (small amount)
      console.log('4️⃣ Creating test payment...');
      const payment = await goCardlessService.createPayment(
        mandate.id,
        {
          amount: 1000, // 1000 pence/cents = $10.00/£10.00
          currency: mandate.scheme === 'ach' ? 'USD' : 
                   mandate.scheme === 'bacs' ? 'GBP' : 
                   mandate.scheme === 'sepa_core' ? 'EUR' : 'GBP',
          description: `Test payment for ${testCase.name}`,
          reference: `TEST-${Date.now()}`,
          chargeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          internalCustomerId: testCase.customerData.internalId
        }
      );
      console.log('✅ Payment created:', payment.id);
      console.log('   Amount:', payment.amount, payment.currency);
      console.log('   Status:', payment.status);
      
      console.log(`\n🎉 ${testCase.name} - ALL TESTS PASSED!`);
      
    } catch (error) {
      console.error(`❌ ${testCase.name} - FAILED:`);
      console.error('Error:', error.message);
      
      if (error.errors) {
        console.error('Validation errors:');
        error.errors.forEach(err => {
          console.error(`  - ${err.field}: ${err.message}`);
        });
      }
    }
  }
  
  console.log('\n🔍 Testing Environment Detection');
  console.log('================================');
  console.log('Environment:', process.env.GOCARDLESS_ENVIRONMENT || 'sandbox');
  console.log('Access Token:', process.env.GOCARDLESS_ACCESS_TOKEN ? '✅ Set' : '❌ Missing');
  
  console.log('\n📊 Scheme Detection Test');
  console.log('========================');
  const countries = ['US', 'GB', 'CA', 'DE', 'FR', 'AU', 'NZ', 'SE', 'DK', 'NO'];
  
  for (const country of countries) {
    const scheme = goCardlessService.getSchemeForCountry(country);
    const currency = goCardlessService.getCurrencyForCountry(country);
    console.log(`${country}: ${scheme} (${currency})`);
  }
}

// Run the test
testGoCardlessIntegration()
  .then(() => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }); 