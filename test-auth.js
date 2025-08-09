const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAdminAuth() {
  try {
    console.log('🔧 Testing admin authentication...');

    // Test admin login
    const loginResponse = await fetch('http://localhost:8000/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@siteworks.com',
        password: 'Admin@123'
      })
    });

    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginData);
      return;
    }

    console.log('✅ Login successful');
    console.log('Token:', loginData.tokens.accessToken.substring(0, 50) + '...');

    // Test admin dashboard access
    const dashboardResponse = await fetch('http://localhost:8000/api/admin/dashboard', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.tokens.accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    const dashboardData = await dashboardResponse.json();
    
    if (!dashboardResponse.ok) {
      console.log('❌ Dashboard access failed:', dashboardData);
      return;
    }

    console.log('✅ Dashboard access successful');
    console.log('Dashboard data:', JSON.stringify(dashboardData, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminAuth(); 