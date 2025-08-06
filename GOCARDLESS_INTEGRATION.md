# GoCardless Integration Guide

This document explains how the GoCardless integration works in our customer registration system.

## Overview

The GoCardless integration automatically creates customers and mandates during the sign-up process, enabling direct debit payments for your services.

## Features

- **Automatic Customer Creation**: Creates GoCardless customers during registration
- **Mandate Setup**: Automatically creates payment mandates for direct debit
- **Error Handling**: Graceful fallback if GoCardless is unavailable
- **Status Tracking**: Monitors mandate status and updates
- **Retry Mechanism**: Manual setup endpoint for failed integrations

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# GoCardless Configuration
GOCARDLESS_ACCESS_TOKEN=your_gocardless_access_token_here
GOCARDLESS_ENVIRONMENT=sandbox  # or 'live' for production
```

### Getting Your Access Token

1. **Sandbox (Testing)**: 
   - Go to [GoCardless Sandbox Dashboard](https://manage-sandbox.gocardless.com/developers)
   - Create an API key under "Developers" → "Create" → "Access Token"

2. **Live (Production)**:
   - Go to [GoCardless Live Dashboard](https://manage.gocardless.com/developers)
   - Create an API key under "Developers" → "Create" → "Access Token"

## Database Schema

The integration adds these fields to the `Customer` model:

```prisma
model Customer {
  // ... existing fields ...
  
  // GoCardless Integration
  goCardlessCustomerId String? // GoCardless customer ID
  goCardlessMandateId  String? // GoCardless mandate ID
  mandateStatus        String? // active, pending_submission, submitted, active, failed, cancelled, expired
}
```

## API Endpoints

### 1. Customer Registration
**POST** `/api/customers/register`

Now automatically creates GoCardless customer and mandate during registration.

**Response includes GoCardless data:**
```json
{
  "success": true,
  "customer": {
    "id": "cust_123",
    "email": "user@example.com",
    "goCardlessCustomerId": "CU123456789",
    "goCardlessMandateId": "MD123456789",
    "mandateStatus": "pending_submission"
  }
}
```

### 2. Setup GoCardless (Retry)
**POST** `/api/customers/setup-gocardless`

Manually setup GoCardless integration if it failed during registration.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "GoCardless integration setup successfully",
  "data": {
    "customerId": "CU123456789",
    "mandateId": "MD123456789",
    "mandateStatus": "pending_submission"
  }
}
```

### 3. Get GoCardless Status
**GET** `/api/customers/gocardless-status`

Get current GoCardless integration status and mandate details.

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
    "hasMandate": true,
    "customerId": "CU123456789",
    "mandateId": "MD123456789",
    "mandateStatus": "active",
    "mandateDetails": {
      "id": "MD123456789",
      "status": "active",
      "reference": "MANDATE-cust_123-1234567890",
      "scheme": "bacs",
      "created_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Payment Schemes

The system automatically selects the appropriate payment scheme:

- **UK customers** (`countryOfResidence: 'GB'`): Uses **BACS**
- **EU customers**: Uses **SEPA Core**
- **Other regions**: Contact GoCardless for supported schemes

## Mandate Statuses

| Status | Description |
|--------|-------------|
| `pending_submission` | Mandate created but not yet submitted |
| `submitted` | Mandate submitted to the bank |
| `active` | Mandate is active and ready for payments |
| `failed` | Mandate setup failed |
| `cancelled` | Mandate was cancelled |
| `expired` | Mandate has expired |

## Error Handling

The integration includes comprehensive error handling:

1. **Registration Continues**: If GoCardless fails, customer registration still completes
2. **Retry Mechanism**: Use `/setup-gocardless` endpoint to retry setup
3. **Graceful Degradation**: System works without GoCardless if needed
4. **Detailed Logging**: All errors are logged for debugging

## Testing

### Run the Test Script

```bash
cd backend
node test-gocardless.js
```

This will:
- Verify your configuration
- Test customer creation
- Test mandate creation
- Test data retrieval

### Manual Testing

1. **Set your sandbox token** in `.env`
2. **Register a new customer** through the frontend
3. **Check the console logs** for GoCardless activity
4. **Verify in GoCardless dashboard** that customer and mandate were created

## Production Checklist

Before going live:

- [ ] Switch to live GoCardless environment
- [ ] Update `GOCARDLESS_ENVIRONMENT=live`
- [ ] Use live access token
- [ ] Test with real bank account details
- [ ] Verify webhook endpoints (if using webhooks)
- [ ] Monitor mandate statuses

## Troubleshooting

### Common Issues

1. **"Invalid access token"**
   - Check your token is correct
   - Ensure you're using the right environment (sandbox/live)

2. **"Customer creation failed"**
   - Verify customer data format
   - Check required fields are present
   - Ensure country code is supported

3. **"Mandate creation failed"**
   - Customer must exist first
   - Check payment scheme is supported in customer's country
   - Verify mandate reference is unique

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

This will show detailed GoCardless API requests and responses in the console.

## Support

- **GoCardless Documentation**: https://developer.gocardless.com/
- **GoCardless Support**: https://gocardless.com/support/
- **API Reference**: https://developer.gocardless.com/api-reference/

## Security Notes

- Never expose access tokens in client-side code
- Use environment variables for sensitive configuration
- Regularly rotate access tokens
- Monitor API usage and rate limits
- Implement proper error handling to avoid exposing sensitive data