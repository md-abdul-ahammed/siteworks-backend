require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  console.log('🔍 Testing database connection...');
  console.log('📊 Environment variables:');
  console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('- DIRECT_URL:', process.env.DIRECT_URL ? 'Set' : 'Not set');
  console.log('- NODE_ENV:', process.env.NODE_ENV);

  try {
    console.log('\n1️⃣ Testing basic connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Basic connection successful');

    console.log('\n2️⃣ Testing simple query...');
    
    // Test a simple query
    const userCount = await prisma.customer.count();
    console.log(`✅ Query successful - Found ${userCount} customers`);

    console.log('\n3️⃣ Testing admin user query...');
    
    // Test admin user query
    const adminUsers = await prisma.customer.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });
    
    console.log(`✅ Admin query successful - Found ${adminUsers.length} admin users`);
    
    if (adminUsers.length > 0) {
      console.log('📋 Admin users:');
      adminUsers.forEach(user => {
        console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
      });
    }

    console.log('\n4️⃣ Testing user query with filters...');
    
    // Test the exact query that the admin dashboard uses
    const users = await prisma.customer.findMany({
      where: { role: 'user' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLoginAt: true,
        goCardlessCustomerId: true,
        goCardlessBankAccountId: true,
        goCardlessMandateId: true,
        mandateStatus: true,
        openPhoneContactId: true,
        countryOfResidence: true,
        city: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`✅ User query successful - Found ${users.length} users`);
    
    if (users.length > 0) {
      console.log('📋 Sample users:');
      users.slice(0, 3).forEach(user => {
        console.log(`  - ${user.firstName} ${user.lastName} (${user.email}) - ${user.isActive ? 'Active' : 'Inactive'}`);
      });
    }

    console.log('\n🎉 All database tests passed!');
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    
    if (error.code === 'P1001') {
      console.error('\n🔧 Connection Error Details:');
      console.error('- Error Code: P1001 (Connection failed)');
      console.error('- This usually means the database server is not reachable');
      console.error('- Check your DATABASE_URL and DIRECT_URL environment variables');
      console.error('- Verify your Supabase project is active');
      console.error('- Check if your IP is whitelisted in Supabase');
    }
    
    if (error.code === 'P1017') {
      console.error('\n🔧 Authentication Error Details:');
      console.error('- Error Code: P1017 (Server closed the connection)');
      console.error('- This usually means invalid credentials');
      console.error('- Check your database username and password');
    }
    
    if (error.code === 'P2002') {
      console.error('\n🔧 Unique Constraint Error Details:');
      console.error('- Error Code: P2002 (Unique constraint failed)');
      console.error('- This is a data constraint issue, not a connection issue');
    }
    
    console.error('\n💡 Troubleshooting Tips:');
    console.error('1. Check your Supabase project status at https://supabase.com/dashboard');
    console.error('2. Verify your database credentials in the .env file');
    console.error('3. Make sure your IP is whitelisted in Supabase');
    console.error('4. Try connecting with a different database client');
    console.error('5. Check if your Supabase project has reached its limits');
    
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testDatabaseConnection().catch(console.error); 