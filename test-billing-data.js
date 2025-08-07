const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function createTestBillingData() {
  try {
    console.log('Creating test billing data...');

    // First, let's get a customer
    const customer = await prisma.customer.findFirst();
    
    if (!customer) {
      console.log('No customer found. Please create a customer first.');
      return;
    }

    console.log(`Using customer: ${customer.email}`);

    // Create sample billing history records
    const billingRecords = [
      {
        customerId: customer.id,
        goCardlessPaymentId: 'PM123456789',
        zohoInvoiceId: 'INV001',
        amount: 150.00,
        currency: 'GBP',
        status: 'paid',
        description: 'Website Development Services',
        dueDate: new Date('2024-01-15'),
        paidAt: new Date('2024-01-10'),
        createdAt: new Date('2024-01-05')
      },
      {
        customerId: customer.id,
        goCardlessPaymentId: 'PM987654321',
        zohoInvoiceId: 'INV002',
        amount: 75.50,
        currency: 'GBP',
        status: 'paid',
        description: 'Monthly Hosting Fee',
        dueDate: new Date('2024-02-15'),
        paidAt: new Date('2024-02-12'),
        createdAt: new Date('2024-02-01')
      },
      {
        customerId: customer.id,
        goCardlessPaymentId: 'PM456789123',
        zohoInvoiceId: 'INV003',
        amount: 200.00,
        currency: 'GBP',
        status: 'pending',
        description: 'SEO Optimization Services',
        dueDate: new Date('2024-03-20'),
        createdAt: new Date('2024-03-01')
      },
      {
        customerId: customer.id,
        goCardlessPaymentId: 'PM789123456',
        zohoInvoiceId: 'INV004',
        amount: 125.00,
        currency: 'GBP',
        status: 'paid',
        description: 'Content Management System',
        dueDate: new Date('2024-01-30'),
        paidAt: new Date('2024-01-25'),
        createdAt: new Date('2024-01-20')
      },
      {
        customerId: customer.id,
        goCardlessPaymentId: 'PM321654987',
        zohoInvoiceId: 'INV005',
        amount: 300.00,
        currency: 'GBP',
        status: 'failed',
        description: 'E-commerce Integration',
        dueDate: new Date('2024-02-28'),
        createdAt: new Date('2024-02-15')
      }
    ];

    // Insert billing records
    const createdBillingRecords = [];
    for (const record of billingRecords) {
      const createdRecord = await prisma.billingHistory.create({
        data: record
      });
      createdBillingRecords.push(createdRecord);
      console.log(`Created billing record: ${createdRecord.id}`);
    }

    // Create sample receipts for each billing record
    const receipts = [
      {
        billingHistoryId: createdBillingRecords[0].id,
        customerId: customer.id,
        goCardlessPaymentId: 'PM123456789',
        zohoInvoiceId: 'INV001',
        fileName: 'receipt-INV001.pdf',
        fileUrl: 'https://example.com/receipts/receipt-INV001.pdf',
        fileSize: 245760,
        mimeType: 'application/pdf',
        isDownloaded: false
      },
      {
        billingHistoryId: createdBillingRecords[0].id,
        customerId: customer.id,
        goCardlessPaymentId: 'PM123456789',
        zohoInvoiceId: 'INV001',
        fileName: 'invoice-INV001.pdf',
        fileUrl: 'https://example.com/invoices/invoice-INV001.pdf',
        fileSize: 512000,
        mimeType: 'application/pdf',
        isDownloaded: true,
        downloadedAt: new Date('2024-01-10')
      },
      {
        billingHistoryId: createdBillingRecords[1].id,
        customerId: customer.id,
        goCardlessPaymentId: 'PM987654321',
        zohoInvoiceId: 'INV002',
        fileName: 'receipt-INV002.pdf',
        fileUrl: 'https://example.com/receipts/receipt-INV002.pdf',
        fileSize: 198432,
        mimeType: 'application/pdf',
        isDownloaded: false
      },
      {
        billingHistoryId: createdBillingRecords[2].id,
        customerId: customer.id,
        goCardlessPaymentId: 'PM456789123',
        zohoInvoiceId: 'INV003',
        fileName: 'invoice-INV003.pdf',
        fileUrl: 'https://example.com/invoices/invoice-INV003.pdf',
        fileSize: 367104,
        mimeType: 'application/pdf',
        isDownloaded: false
      },
      {
        billingHistoryId: createdBillingRecords[3].id,
        customerId: customer.id,
        goCardlessPaymentId: 'PM789123456',
        zohoInvoiceId: 'INV004',
        fileName: 'receipt-INV004.pdf',
        fileUrl: 'https://example.com/receipts/receipt-INV004.pdf',
        fileSize: 289792,
        mimeType: 'application/pdf',
        isDownloaded: true,
        downloadedAt: new Date('2024-01-25')
      },
      {
        billingHistoryId: createdBillingRecords[3].id,
        customerId: customer.id,
        goCardlessPaymentId: 'PM789123456',
        zohoInvoiceId: 'INV004',
        fileName: 'invoice-INV004.pdf',
        fileUrl: 'https://example.com/invoices/invoice-INV004.pdf',
        fileSize: 423936,
        mimeType: 'application/pdf',
        isDownloaded: false
      }
    ];

    // Insert receipts
    for (const receipt of receipts) {
      const createdReceipt = await prisma.receipt.create({
        data: receipt
      });
      console.log(`Created receipt: ${createdReceipt.fileName}`);
    }

    console.log('✅ Test billing data created successfully!');
    console.log(`📊 Created ${createdBillingRecords.length} billing records`);
    console.log(`📄 Created ${receipts.length} receipts`);

  } catch (error) {
    console.error('❌ Error creating test billing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
createTestBillingData(); 