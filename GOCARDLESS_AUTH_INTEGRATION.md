# GoCardless Auth Integration

## Overview

This document describes the integration of GoCardless payment processing with the authentication/registration system. The integration allows customers to set up direct debit mandates during the registration process or later through their profile.

## Features

### 1. Registration with GoCardless Integration

Customers can now register with bank details to automatically set up GoCardless integration:

- **Optional Bank Details**: Customers can provide bank details during registration
- **Automatic GoCardless Setup**: If bank details are provided, GoCardless customer, bank account, and mandate are created automatically
- **Graceful Fallback**: If GoCardless setup fails, registration still succeeds and customer can set up GoCardless later
- **Comprehensive Response**: Registration response includes GoCardless integration status
- **Country-Specific Handling**: Proper handling of different banking requirements for US, UK, and other countries

### 2. Post-Registration GoCardless Setup

Customers who didn't provide bank details during registration can set up GoCardless later:

- **Setup Endpoint**: `/auth/setup-gocardless` for authenticated users
- **Status Checking**: `/auth/gocardless-status` to check current integration status
- **Error Handling**: Comprehensive error handling for GoCardless API failures

## API Endpoints

### Registration with GoCardless

**POST** `/auth/register`

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Acme Corp",
  "phone": "+1234567890",
  "countryOfResidence": "US",
  "addressLine1": "123 Main Street",
  "addressLine2": "Suite 100",
  "city": "New York",
  "postcode": "10001",
  "state": "NY",
  "accountHolderName": "John Doe",
  "bankCode": "021000021",
  "accountNumber": "1234567890",
  "accountType": "checking",
  "preferredCurrency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer registered successfully",
  "customer": {
    "id": "customer_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "goCardlessCustomerId": "CU123456789",
    "goCardlessBankAccountId": "BA123456789",
    "goCardlessMandateId": "MD123456789",
    "mandateStatus": "pending_submission"
  },
  "gocardless": {
    "integrated": true,
    "customerId": "CU123456789",
    "bankAccountId": "created",
    "mandateId": "MD123456789",
    "mandateStatus": "pending_submission"
  },
  "tokens": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresAt": "2024-01-01T00:15:00.000Z"
  }
}
```

### Check GoCardless Status

**GET** `/auth/gocardless-status`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasGoCardlessCustomer": true,
    "hasBankAccount": true,
    "hasMandate": true,
    "customerId": "CU123456789",
    "bankAccountId": "BA123456789",
    "mandateId": "MD123456789",
    "mandateStatus": "pending_submission",
    "mandateDetails": {
      "id": "MD123456789",
      "status": "pending_submission",
      "reference": "MANDATE-123-1704067200000",
      "scheme": "ach",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Setup GoCardless Integration

**POST** `/auth/setup-gocardless`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "accountHolderName": "John Doe",
  "bankCode": "021000021",
  "accountNumber": "1234567890",
  "accountType": "checking"
}
```

**Response:**
```json
{
  "success": true,
  "message": "GoCardless integration setup successfully",
  "data": {
    "customerId": "CU123456789",
    "bankAccountId": "BA123456789",
    "mandateId": "MD123456789",
    "mandateStatus": "pending_submission"
  }
}
```

## Country-Specific Requirements

### United States (US)
- **bankCode**: US routing number (9 digits, e.g., "021000021" for JPMorgan Chase)
- **accountType**: Required - must be "checking" or "savings"
- **branch_code**: Not used for US
- **bank_code**: Required - use the routing number
- **Scheme**: ACH

### Canada (CA)
- **bankCode**: Canadian routing number (8 digits, e.g., "000200010")
- **accountType**: Required - must be "checking" or "savings"
- **branch_code**: Not used for Canada
- **bank_code**: Required - use the routing number
- **Scheme**: ACH

### Australia (AU)
- **bankCode**: Australian BSB code (6 digits, e.g., "012345")
- **accountType**: Required - must be "checking" or "savings"
- **branch_code**: Not used for Australia
- **bank_code**: Required - use the BSB code
- **Scheme**: ACH

### New Zealand (NZ)
- **bankCode**: New Zealand bank code (2 digits) + branch code (4 digits), e.g., "010001"
- **accountType**: Required - must be "checking" or "savings"
- **branch_code**: Not used for New Zealand
- **bank_code**: Required - use the bank + branch code
- **Scheme**: ACH

### United Kingdom (GB)
- **bankCode**: UK sort code (6 digits, e.g., "123456")
- **accountType**: Required - must be "checking" or "savings"
- **branch_code**: Required - use the sort code
- **bank_code**: Not used for UK
- **Scheme**: BACS

### European Union (SEPA)
- **bankCode**: Bank code according to country (varies by country)
- **accountType**: Required - must be "checking" or "savings"
- **branch_code**: Required for most SEPA countries
- **Scheme**: SEPA Core

## Database Schema

The customer table includes GoCardless fields:

```sql
-- GoCardless Integration fields
goCardlessCustomerId String? // GoCardless customer ID
goCardlessBankAccountId String? // GoCardless customer bank account ID
goCardlessMandateId String? // GoCardless mandate ID
mandateStatus String? // active, pending_submission, submitted, active, failed, cancelled, expired
```

## Implementation Details

### Registration Flow

1. **Customer Creation**: Customer is created in database first
2. **Bank Details Check**: If bank details are provided, proceed with GoCardless
3. **GoCardless Customer**: Create GoCardless customer with address and personal info
4. **Bank Account**: Create GoCardless customer bank account with provided details
5. **Mandate Creation**: Create mandate linked to the bank account
6. **Database Update**: Update customer record with GoCardless IDs
7. **Response**: Return comprehensive response with GoCardless status

### Error Handling

- **GoCardless Failures**: Registration succeeds even if GoCardless setup fails
- **Validation**: Comprehensive validation for all bank details
- **Idempotency**: Uses UUID for idempotency keys to prevent duplicates
- **Logging**: Detailed logging for debugging and monitoring

### Security

- **Bank Details**: Bank details are not stored in database (only logged to console)
- **Token Security**: JWT tokens for authentication
- **Rate Limiting**: Rate limiting on all endpoints
- **Validation**: Input validation on all fields

## Testing

Run the test script to verify integration:

```bash
node test-gocardless-auth-integration.js
```

This will test:
1. Registration with GoCardless integration
2. Registration without GoCardless integration
3. Post-registration GoCardless setup
4. Status checking
5. Error handling

## Environment Variables

Required for GoCardless integration:

```env
GOCARDLESS_ACCESS_TOKEN=your_gocardless_access_token
GOCARDLESS_ENVIRONMENT=sandbox  # or 'live'
```

## Mandate Statuses

- `pending_submission`: Mandate created, waiting for submission
- `submitted`: Mandate submitted to bank
- `active`: Mandate active and ready for payments
- `failed`: Mandate setup failed
- `cancelled`: Mandate cancelled
- `expired`: Mandate expired

## Currency Support

Supported currencies based on country:
- `GB`: GBP (BACS)
- `US`: USD (ACH)
- `DE`, `FR`, `IT`, `ES`, `NL`, `BE`, `AT`, `IE`, `PT`, `FI`, `LU`: EUR (SEPA)
- `SE`: SEK
- `DK`: DKK
- `NO`: NOK
- `AU`: AUD
- `CA`: CAD
- `NZ`: NZD

## Next Steps

1. **Frontend Integration**: Update frontend to handle GoCardless integration during registration
2. **Payment Processing**: Implement payment collection using the created mandates
3. **Webhook Handling**: Add webhook endpoints for mandate status updates
4. **Error Recovery**: Implement retry mechanisms for failed GoCardless operations
5. **Monitoring**: Add monitoring and alerting for GoCardless integration health 