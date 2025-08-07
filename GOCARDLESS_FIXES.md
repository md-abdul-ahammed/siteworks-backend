# GoCardless Integration Fixes

## Problem Fixed

The original issue was that the GoCardless integration was trying to create BACS mandates (GBP payments) with USD bank accounts, which is not supported. The error was:

```
"is a USD account, so it does not support GBP (bacs) payments"
```

## Root Cause

The `createMandate` method was hardcoded to use 'bacs' scheme for all countries, regardless of the bank account's currency and country.

## Solution Implemented

### 1. Dynamic Scheme Detection

Updated the `createMandate` method to automatically detect the correct payment scheme based on the country code:

```javascript
// Determine scheme based on country code if not explicitly provided
let scheme = mandateData.scheme;
if (!scheme && mandateData.countryCode) {
  scheme = this.getSchemeForCountry(mandateData.countryCode);
} else if (!scheme) {
  scheme = 'bacs'; // Default to BACS for UK
}
```

### 2. Country-Specific Scheme Mapping

The `getSchemeForCountry` method maps countries to their appropriate payment schemes:

- **US, CA, AU, NZ**: `ach` (USD/CAD/AUD/NZD)
- **GB**: `bacs` (GBP)
- **EU Countries**: `sepa_core` (EUR)

### 3. Updated Auth Route

Modified the auth route to pass the country code to mandate creation:

```javascript
goCardlessMandate = await goCardlessService.createMandate(
  goCardlessBankAccount.id,
  {
    countryCode: customer.countryOfResidence,
    payerIpAddress: (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1') ? req.ip : '8.8.8.8',
    internalCustomerId: customer.id
  }
);
```

## Supported Countries and Schemes

| Country | Scheme | Currency | Description |
|---------|--------|----------|-------------|
| US | ach | USD | Automated Clearing House |
| CA | ach | CAD | Canadian ACH |
| AU | ach | AUD | Australian ACH |
| NZ | ach | NZD | New Zealand ACH |
| GB | bacs | GBP | Bankers' Automated Clearing Services |
| DE, FR, IT, ES, NL, BE, AT, IE, PT, FI, LU | sepa_core | EUR | Single Euro Payments Area |
| SE | sepa_core | SEK | Swedish SEPA |
| DK | sepa_core | DKK | Danish SEPA |
| NO | sepa_core | NOK | Norwegian SEPA |

## Environment Configuration

### Sandbox Environment

```bash
GOCARDLESS_ENVIRONMENT=sandbox
GOCARDLESS_ACCESS_TOKEN=sandbox_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Live Environment

```bash
GOCARDLESS_ENVIRONMENT=live
GOCARDLESS_ACCESS_TOKEN=live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Testing

### 1. Test US Customer (USD + ACH)

```bash
node test-gocardless-us-fix.js
```

This test verifies:
- US customer creation
- USD bank account creation
- ACH mandate creation
- USD payment creation

### 2. Comprehensive Test (All Countries)

```bash
node test-gocardless-fixed.js
```

This test covers:
- US (ACH + USD)
- UK (BACS + GBP)
- CA (ACH + CAD)
- DE (SEPA + EUR)

## Usage Examples

### Creating a US Customer

```javascript
const goCardlessService = new GoCardlessService();

// Create customer
const customer = await goCardlessService.createCustomer({
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  countryOfResidence: 'US',
  address: {
    line1: '123 Main St',
    city: 'New York',
    postcode: '10001',
    state: 'NY'
  }
});

// Create bank account
const bankAccount = await goCardlessService.createCustomerBankAccount(
  customer.id,
  {
    accountHolderName: 'John Doe',
    bankCode: '021000021',
    accountNumber: '123456789',
    accountType: 'checking',
    countryCode: 'US'
  }
);

// Create mandate (automatically uses ACH for US)
const mandate = await goCardlessService.createMandate(
  bankAccount.id,
  {
    countryCode: 'US'
  }
);
```

### Creating a UK Customer

```javascript
// Create customer
const customer = await goCardlessService.createCustomer({
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  countryOfResidence: 'GB',
  address: {
    line1: '456 High Street',
    city: 'London',
    postcode: 'SW1A 1AA'
  }
});

// Create bank account
const bankAccount = await goCardlessService.createCustomerBankAccount(
  customer.id,
  {
    accountHolderName: 'Jane Smith',
    bankCode: '123456', // Sort code
    accountNumber: '12345678',
    countryCode: 'GB'
  }
);

// Create mandate (automatically uses BACS for UK)
const mandate = await goCardlessService.createMandate(
  bankAccount.id,
  {
    countryCode: 'GB'
  }
);
```

## Error Handling

The integration now properly handles:

1. **Currency Mismatch**: Automatically uses correct currency for each country
2. **Scheme Mismatch**: Automatically uses correct scheme for each country
3. **Validation Errors**: Detailed error messages for debugging
4. **Graceful Degradation**: If GoCardless fails, customer registration still completes

## Migration from Old Version

If you have existing customers with incorrect mandates:

1. **Sandbox**: Delete and recreate mandates for testing
2. **Live**: Contact GoCardless support to cancel incorrect mandates
3. **New Customers**: Will automatically use correct schemes

## Monitoring

Monitor the following logs for successful integration:

```
✅ Customer created: CU123456789
✅ Bank account created: BA123456789
✅ Mandate created: MD123456789
   Scheme: ach (for US)
   Status: pending_submission
```

## Troubleshooting

### Common Issues

1. **"Validation failed"**: Check country code and bank details
2. **"Currency mismatch"**: Ensure bank account and mandate use same currency
3. **"Scheme not supported"**: Verify country supports the detected scheme

### Debug Commands

```bash
# Test specific country
node test-gocardless-us-fix.js

# Test all countries
node test-gocardless-fixed.js

# Check environment
echo $GOCARDLESS_ENVIRONMENT
echo $GOCARDLESS_ACCESS_TOKEN
```

## Security Notes

1. **Sandbox vs Live**: Always test in sandbox first
2. **Access Tokens**: Keep tokens secure and rotate regularly
3. **Webhooks**: Verify webhook signatures in production
4. **Idempotency**: All requests use unique idempotency keys

## Support

For issues:
1. Check the test scripts for your specific country
2. Verify environment variables are set correctly
3. Review GoCardless API documentation for your region
4. Contact GoCardless support for account-specific issues 