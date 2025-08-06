# OpenPhone Integration

This document describes the OpenPhone API integration for automatically creating contacts when users sign up.

## Overview

The OpenPhone integration automatically creates a contact in OpenPhone when a new customer registers on the platform. This allows for seamless communication management and contact synchronization.

## Features

- **Automatic Contact Creation**: When a user signs up, a contact is automatically created in OpenPhone
- **Contact Synchronization**: Contact details are synced between SiteWorks and OpenPhone
- **Error Handling**: Integration failures don't break the registration process
- **Optional Integration**: Works even if OpenPhone API key is not configured

## Configuration

### Environment Variables

Add the following environment variable to your `.env` file:

```env
OPENPHONE_API_KEY=your_openphone_api_key_here
```

### Getting OpenPhone API Key

1. Log in to your OpenPhone account
2. Go to Settings > API
3. Generate a new API key
4. Copy the API key and add it to your environment variables

## API Endpoints

### Contact Creation

When a user registers, the system automatically:

1. Creates a customer record in the database
2. Creates a contact in OpenPhone with the following data:
   - First Name
   - Last Name
   - Email Address
   - Phone Number (if provided)
   - Company Name (if provided)
   - Notes (includes SiteWorks customer ID)

### Contact Data Structure

```javascript
{
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "+1234567890", // Optional
  companyName: "Acme Corp", // Optional
  notes: "Customer from SiteWorks - ID: cust_123456"
}
```

## Database Schema

The `Customer` model includes an `openPhoneContactId` field to store the OpenPhone contact ID:

```prisma
model Customer {
  // ... other fields ...
  
  // OpenPhone Integration
  openPhoneContactId   String? // OpenPhone contact ID
}
```

## Service Methods

### OpenPhoneService

The `OpenPhoneService` class provides the following methods:

- `createContact(contactData)` - Creates a new contact in OpenPhone
- `updateContact(contactId, contactData)` - Updates an existing contact
- `getContactByEmail(email)` - Retrieves a contact by email
- `deleteContact(contactId)` - Deletes a contact
- `isConfigured()` - Checks if the API key is configured

## Error Handling

The integration is designed to be non-blocking:

- If OpenPhone API key is not configured, contact creation is skipped
- If OpenPhone API calls fail, the error is logged but doesn't break registration
- All OpenPhone operations are wrapped in try-catch blocks

## Response Format

The registration response includes OpenPhone integration status:

```javascript
{
  success: true,
  message: "Customer registered successfully",
  customer: { /* customer data */ },
  gocardless: { /* gocardless data */ },
  openphone: {
    integrated: true,
    contactId: "contact_123456"
  },
  tokens: { /* auth tokens */ }
}
```

## Testing

### Test Contact Creation

1. Set up your OpenPhone API key in the environment
2. Register a new customer through the signup form
3. Check the OpenPhone dashboard to verify the contact was created
4. Verify the contact details match the registration data

### Test Without API Key

1. Remove or comment out the `OPENPHONE_API_KEY` environment variable
2. Register a new customer
3. Verify the registration succeeds without OpenPhone integration
4. Check the logs for the "API key not configured" message

## Troubleshooting

### Common Issues

1. **API Key Not Found**: Ensure `OPENPHONE_API_KEY` is set in your environment
2. **Contact Creation Fails**: Check the API key permissions and network connectivity
3. **Database Migration Issues**: Run `npx prisma migrate dev` to apply schema changes

### Log Messages

The integration provides detailed logging:

- `Creating OpenPhone contact for: email@example.com`
- `OpenPhone contact created successfully: contact_123456`
- `OpenPhone contact creation skipped (API not configured or failed)`
- `OpenPhone integration failed: [error details]`

## Future Enhancements

- Contact update synchronization when customer profile is updated
- Bulk contact import functionality
- Contact tagging and categorization
- Webhook integration for real-time updates
- Contact activity logging and analytics

## Security Considerations

- API keys are stored securely in environment variables
- No sensitive data is logged
- Failed API calls don't expose internal system details
- Integration is optional and doesn't affect core functionality 