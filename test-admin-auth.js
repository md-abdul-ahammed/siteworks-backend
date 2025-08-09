require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function testAdminAuth() {
  try {
    console.log('🔧 Testing admin authentication...');

    // Find admin user
    const admin = await prisma.customer.findFirst({
      where: { role: 'admin' },
      include: { adminData: true }
    });

    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }

    console.log('✅ Admin found:', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      isVerified: admin.isVerified,
      isActive: admin.isActive,
      adminData: admin.adminData
    });

    // Test password verification
    const password = 'Admin123!';
    const isValidPassword = await bcrypt.compare(password, admin.password);
    console.log('🔐 Password valid:', isValidPassword);

    if (isValidPassword) {
      // Generate token
      const token = jwt.sign(
        { customerId: admin.id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      console.log('🎫 Token generated:', token.substring(0, 50) + '...');

      // Test token verification
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified, customerId:', decoded.customerId);
    }

  } catch (error) {
    console.error('❌ Error testing admin auth:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminAuth(); 