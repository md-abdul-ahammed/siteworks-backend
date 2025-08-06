# SiteWorks Backend - Brevo OTP Integration

This backend provides OTP (One-Time Password) verification using Brevo (formerly Sendinblue) email service.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the backend directory with the following variables:

```env
# Brevo API Configuration
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=your-verified-email@yourdomain.com
BREVO_SENDER_NAME=SiteWorks

# Server Configuration
PORT=8000
```

### 3. Get Brevo API Key
1. Sign up for a free Brevo account at https://www.brevo.com/
2. Go to your Brevo dashboard
3. Navigate to Settings > API Keys
4. Create a new API key with "Transactional Email" permissions
5. Copy the API key and add it to your `.env` file

### 4. Verify Sender Email
1. In your Brevo dashboard, go to Settings > Senders & IP
2. Add and verify your sender email address
3. Use this verified email in the `BREVO_SENDER_EMAIL` environment variable

### 5. Start the Server
```bash
npm run dev
```

## API Endpoints

### Check Email Existence
- **POST** `/api/check-email`
- **Body:** `{ "email": "user@example.com" }`
- **Response:** 
  - If email exists: `{ "error": "Email is already taken", "code": "EMAIL_EXISTS", "exists": true }`
  - If email available: `{ "success": true, "message": "Email is available", "exists": false, "email": "user@example.com" }`

### Send OTP
- **POST** `/api/send-otp`
- **Body:** `{ "email": "user@example.com" }`
- **Response:** `{ "success": true, "message": "OTP sent successfully", "email": "user@example.com" }`

### Verify OTP
- **POST** `/api/verify-otp`
- **Body:** `{ "email": "user@example.com", "otp": "123456" }`
- **Response:** `{ "success": true, "message": "OTP verified successfully", "email": "user@example.com" }`

## Features

- ✅ 6-digit OTP generation
- ✅ 10-minute OTP expiration
- ✅ Email delivery via Brevo
- ✅ CORS enabled for frontend integration
- ✅ Error handling and validation
- ✅ In-memory OTP storage (for development)

## Production Considerations

For production deployment:
1. Use Redis or a database for OTP storage instead of in-memory Map
2. Add rate limiting for OTP requests
3. Implement proper logging
4. Add authentication middleware
5. Use HTTPS in production

## Testing

You can test the API endpoints using curl:

```bash
# Check if email exists
curl -X POST http://localhost:8000/api/check-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Send OTP
curl -X POST http://localhost:8000/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Verify OTP (replace with actual OTP received)
curl -X POST http://localhost:8000/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
``` 