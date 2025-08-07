# Billing API Documentation

This document describes the billing history and receipt management API endpoints.

## Base URL
```
http://localhost:8000/api/billing
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Billing History

**GET** `/history`

Retrieves the billing history for the authenticated customer with pagination and filtering options.

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of records per page (default: 10, max: 50)
- `status` (optional): Filter by status - `pending`, `paid`, `failed`, `cancelled`

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/billing/history?page=1&limit=10&status=paid" \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "billingHistory": [
      {
        "id": "clx123456789",
        "customerId": "clx987654321",
        "goCardlessPaymentId": "PM123456789",
        "zohoInvoiceId": "INV001",
        "amount": 150.00,
        "currency": "GBP",
        "status": "paid",
        "description": "Website Development Services",
        "dueDate": "2024-01-15T00:00:00.000Z",
        "paidAt": "2024-01-10T00:00:00.000Z",
        "createdAt": "2024-01-05T00:00:00.000Z",
        "updatedAt": "2024-01-10T00:00:00.000Z",
        "receipts": [
          {
            "id": "clx111111111",
            "fileName": "receipt-INV001.pdf",
            "fileUrl": "https://example.com/receipts/receipt-INV001.pdf",
            "isDownloaded": false,
            "createdAt": "2024-01-10T00:00:00.000Z"
          }
        ],
        "_count": {
          "receipts": 1
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    },
    "summary": {
      "totalBills": 5,
      "totalAmount": 850.50,
      "paidAmount": 350.50,
      "pendingAmount": 500.00
    }
  }
}
```

### 2. Get Specific Billing Record

**GET** `/history/:id`

Retrieves a specific billing record with all associated receipts.

#### Path Parameters
- `id`: Billing record ID

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/billing/history/clx123456789" \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "id": "clx123456789",
    "customerId": "clx987654321",
    "goCardlessPaymentId": "PM123456789",
    "zohoInvoiceId": "INV001",
    "amount": 150.00,
    "currency": "GBP",
    "status": "paid",
    "description": "Website Development Services",
    "dueDate": "2024-01-15T00:00:00.000Z",
    "paidAt": "2024-01-10T00:00:00.000Z",
    "createdAt": "2024-01-05T00:00:00.000Z",
    "updatedAt": "2024-01-10T00:00:00.000Z",
    "receipts": [
      {
        "id": "clx111111111",
        "billingHistoryId": "clx123456789",
        "customerId": "clx987654321",
        "goCardlessPaymentId": "PM123456789",
        "zohoInvoiceId": "INV001",
        "fileName": "receipt-INV001.pdf",
        "fileUrl": "https://example.com/receipts/receipt-INV001.pdf",
        "fileSize": 245760,
        "mimeType": "application/pdf",
        "isDownloaded": false,
        "downloadedAt": null,
        "createdAt": "2024-01-10T00:00:00.000Z"
      }
    ]
  }
}
```

### 3. Download Receipt

**GET** `/receipts/:id/download`

Downloads a specific receipt and marks it as downloaded.

#### Path Parameters
- `id`: Receipt ID

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/billing/receipts/clx111111111/download" \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://example.com/receipts/receipt-INV001.pdf",
    "fileName": "receipt-INV001.pdf",
    "fileSize": 245760,
    "mimeType": "application/pdf"
  }
}
```

### 4. Get Receipts for Billing Record

**GET** `/history/:id/receipts`

Retrieves all receipts for a specific billing record.

#### Path Parameters
- `id`: Billing record ID

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/billing/history/clx123456789/receipts" \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Example Response
```json
{
  "success": true,
  "data": [
    {
      "id": "clx111111111",
      "billingHistoryId": "clx123456789",
      "customerId": "clx987654321",
      "goCardlessPaymentId": "PM123456789",
      "zohoInvoiceId": "INV001",
      "fileName": "receipt-INV001.pdf",
      "fileUrl": "https://example.com/receipts/receipt-INV001.pdf",
      "fileSize": 245760,
      "mimeType": "application/pdf",
      "isDownloaded": false,
      "downloadedAt": null,
      "createdAt": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

### 5. Get All Receipts

**GET** `/receipts`

Retrieves all receipts for the authenticated customer with pagination.

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of records per page (default: 10, max: 50)

#### Example Request
```bash
curl -X GET "http://localhost:8000/api/billing/receipts?page=1&limit=10" \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "receipts": [
      {
        "id": "clx111111111",
        "billingHistoryId": "clx123456789",
        "customerId": "clx987654321",
        "goCardlessPaymentId": "PM123456789",
        "zohoInvoiceId": "INV001",
        "fileName": "receipt-INV001.pdf",
        "fileUrl": "https://example.com/receipts/receipt-INV001.pdf",
        "fileSize": 245760,
        "mimeType": "application/pdf",
        "isDownloaded": false,
        "downloadedAt": null,
        "createdAt": "2024-01-10T00:00:00.000Z",
        "billingHistory": {
          "id": "clx123456789",
          "amount": 150.00,
          "currency": "GBP",
          "status": "paid",
          "description": "Website Development Services",
          "createdAt": "2024-01-05T00:00:00.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 6,
      "totalPages": 1
    }
  }
}
```

## Error Responses

### Validation Error
```json
{
  "error": "Validation failed",
  "details": [
    {
      "type": "field",
      "value": "invalid_status",
      "msg": "Status must be pending, paid, failed, or cancelled",
      "path": "status",
      "location": "query"
    }
  ],
  "code": "VALIDATION_ERROR"
}
```

### Not Found Error
```json
{
  "error": "Billing record not found",
  "code": "BILLING_NOT_FOUND"
}
```

### Unauthorized Error
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

## Data Models

### BillingHistory
```typescript
interface BillingHistory {
  id: string;
  customerId: string;
  goCardlessPaymentId?: string;
  zohoInvoiceId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  description?: string;
  dueDate?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  receipts: Receipt[];
}
```

### Receipt
```typescript
interface Receipt {
  id: string;
  billingHistoryId: string;
  customerId: string;
  goCardlessPaymentId?: string;
  zohoInvoiceId?: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType: string;
  isDownloaded: boolean;
  downloadedAt?: Date;
  createdAt: Date;
}
```

## Integration with GoCardless and Zoho

The billing system integrates with:
- **GoCardless**: For payment processing and payment IDs
- **Zoho**: For invoice management and invoice IDs

When payments are processed through GoCardless and invoices are created in Zoho, the system automatically creates billing records and receipts in the database.

## Frontend Integration

The frontend includes a `BillingHistory` component that displays:
- Summary cards with total bills, amounts, and status breakdown
- Filterable billing history list
- Receipt download functionality
- Pagination support

The component is integrated into the customer dashboard and provides a complete billing management interface. 