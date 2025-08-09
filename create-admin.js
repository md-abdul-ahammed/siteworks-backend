const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔧 Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await prisma.customer.findFirst({
      where: { role: 'admin' }
    });

    if (existingAdmin) {
      console.log('❌ Admin already exists:', existingAdmin.email);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    // Create admin user
    const admin = await prisma.customer.create({
      data: {
        email: 'admin@siteworks.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isVerified: true,
        isActive: true,
        countryOfResidence: 'GB',
        addressLine1: 'Admin Address',
        city: 'Admin City',
        postcode: '00000'
      }
    });

    // Create admin data
    await prisma.admin.create({
      data: {
        customerId: admin.id,
        permissions: ['manage_users', 'view_analytics', 'manage_billing']
      }
    });

    console.log('✅ Admin created successfully:');
    console.log('Email: admin@siteworks.com');
    console.log('Password: Admin123!');
    console.log('ID:', admin.id);

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin(); 