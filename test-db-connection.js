const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

// Database operation with retry logic
const executeWithRetry = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      
      if (error.code === 'P1001' && attempt < maxRetries) {
        // Database connection error, wait and retry
        console.log(`Retrying database operation in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
};

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    await prisma.$connect();
    console.log('✅ Basic connection successful');
    
    // Test simple query
    console.log('2. Testing simple query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Simple query successful:', result);
    
    // Test billing history query with retry logic
    console.log('3. Testing billing history query with retry logic...');
    const billingHistory = await executeWithRetry(async () => {
      return await prisma.billingHistory.findMany({
        take: 5,
        orderBy: {
          createdAt: 'desc'
        }
      });
    });
    console.log('✅ Billing history query successful, found', billingHistory.length, 'records');
    
    // Test count query with retry logic
    console.log('4. Testing count query with retry logic...');
    const count = await executeWithRetry(async () => {
      return await prisma.billingHistory.count();
    });
    console.log('✅ Count query successful, total records:', count);
    
    console.log('🎉 All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    
    if (error.code === 'P1001') {
      console.log('💡 This is a connection issue. Possible solutions:');
      console.log('   - Check your internet connection');
      console.log('   - Verify Supabase is accessible');
      console.log('   - Check if your IP is whitelisted in Supabase');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection(); 