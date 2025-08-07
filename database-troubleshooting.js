const { PrismaClient } = require('@prisma/client');
const net = require('net');
require('dotenv').config();

// Test network connectivity
async function testNetworkConnectivity() {
  console.log('🌐 Testing network connectivity...');
  
  const host = 'aws-0-us-east-1.pooler.supabase.com';
  const port = 5432;
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000; // 5 seconds
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log('✅ Network connection successful');
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log('❌ Connection timeout');
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (error) => {
      console.log('❌ Network connection failed:', error.message);
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

// Test different connection URLs
async function testConnectionURLs() {
  console.log('\n🔗 Testing different connection URLs...');
  
  const urls = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    // Try without pgbouncer
    process.env.DATABASE_URL?.replace('?pgbouncer=true', ''),
    // Try with different SSL modes
    process.env.DATABASE_URL?.replace('?pgbouncer=true', '?sslmode=require'),
    process.env.DATABASE_URL?.replace('?pgbouncer=true', '?sslmode=prefer'),
  ];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    
    console.log(`\nTesting URL ${i + 1}: ${url.replace(/:[^:@]*@/, ':****@')}`);
    
    try {
      const prisma = new PrismaClient({
        datasources: {
          db: { url }
        }
      });
      
      await prisma.$connect();
      console.log('✅ Connection successful');
      await prisma.$disconnect();
      return url; // Return the working URL
    } catch (error) {
      console.log('❌ Connection failed:', error.message);
    }
  }
  
  return null;
}

// Check environment variables
function checkEnvironmentVariables() {
  console.log('\n🔧 Checking environment variables...');
  
  const requiredVars = ['DATABASE_URL', 'DIRECT_URL'];
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      console.log(`✅ ${varName} is set`);
    }
  }
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    return false;
  }
  
  return true;
}

// Generate alternative connection strings
function generateAlternativeConnections() {
  console.log('\n🔄 Generating alternative connection strings...');
  
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    console.log('❌ No DATABASE_URL found');
    return;
  }
  
  // Parse the URL
  const url = new URL(baseUrl);
  
  console.log('Current connection details:');
  console.log(`  Host: ${url.hostname}`);
  console.log(`  Port: ${url.port}`);
  console.log(`  Database: ${url.pathname.slice(1)}`);
  console.log(`  Username: ${url.username}`);
  console.log(`  SSL Mode: ${url.searchParams.get('sslmode') || 'not specified'}`);
  console.log(`  PgBouncer: ${url.searchParams.get('pgbouncer') || 'false'}`);
  
  // Generate alternatives
  const alternatives = [
    `${baseUrl}&sslmode=require`,
    `${baseUrl}&sslmode=prefer`,
    `${baseUrl}&sslmode=allow`,
    baseUrl.replace('?pgbouncer=true', ''),
    baseUrl.replace('?pgbouncer=true', '&sslmode=require'),
  ];
  
  console.log('\nAlternative connection strings to try:');
  alternatives.forEach((alt, index) => {
    console.log(`${index + 1}. ${alt.replace(/:[^:@]*@/, ':****@')}`);
  });
}

// Main troubleshooting function
async function troubleshootDatabase() {
  console.log('🔍 Database Connection Troubleshooting\n');
  
  // Check environment variables
  const envOk = checkEnvironmentVariables();
  if (!envOk) {
    console.log('\n❌ Environment variables are missing. Please check your .env file.');
    return;
  }
  
  // Test network connectivity
  const networkOk = await testNetworkConnectivity();
  if (!networkOk) {
    console.log('\n❌ Network connectivity failed. Possible issues:');
    console.log('   - Firewall blocking outbound connections to port 5432');
    console.log('   - Network restrictions');
    console.log('   - Supabase service might be down');
    console.log('\n💡 Solutions:');
    console.log('   1. Check your firewall settings');
    console.log('   2. Try using a VPN');
    console.log('   3. Contact your network administrator');
    console.log('   4. Check Supabase status page');
    return;
  }
  
  // Test different connection URLs
  const workingUrl = await testConnectionURLs();
  if (workingUrl) {
    console.log('\n✅ Found working connection URL!');
    console.log('💡 Update your .env file with this URL:');
    console.log(`DATABASE_URL="${workingUrl}"`);
    return;
  }
  
  // Generate alternatives
  generateAlternativeConnections();
  
  console.log('\n💡 Additional troubleshooting steps:');
  console.log('   1. Check Supabase dashboard for IP whitelisting');
  console.log('   2. Verify your Supabase project is active');
  console.log('   3. Try connecting from a different network');
  console.log('   4. Contact Supabase support');
}

// Run the troubleshooting
troubleshootDatabase().catch(console.error); 