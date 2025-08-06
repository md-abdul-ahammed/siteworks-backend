require('dotenv').config();

// Test the forgot password functionality
const axios = require('axios');

async function testForgotPassword() {
  try {
    console.log('Testing forgot password functionality...');
    
    // Test with a real email address
    const response = await axios.post('http://localhost:8000/api/forgot-password', {
      email: 'test@example.com'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Forgot password request successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ Forgot password test failed:', error.response?.data || error.message);
  }
}

// Only run if server is running
testForgotPassword(); 