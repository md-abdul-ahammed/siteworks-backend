const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { verifyToken, errorHandler } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard analytics
router.get('/analytics',
  verifyToken,
  async (req, res, next) => {
    try {
      const customerId = req.user.id;

      // Get billing history for analytics
      const billingHistory = await prisma.billingHistory.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate summary statistics
      const summary = await prisma.billingHistory.aggregate({
        where: { customerId },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      });

      const paidAmount = await prisma.billingHistory.aggregate({
        where: {
          customerId,
          status: 'paid'
        },
        _sum: {
          amount: true
        }
      });

      const pendingAmount = await prisma.billingHistory.aggregate({
        where: {
          customerId,
          status: 'pending'
        },
        _sum: {
          amount: true
        }
      });

      const failedAmount = await prisma.billingHistory.aggregate({
        where: {
          customerId,
          status: 'failed'
        },
        _sum: {
          amount: true
        }
      });

      // Calculate monthly data for charts
      const monthlyData = [];
      const currentDate = new Date();
      const months = 6;

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        
        const monthBills = billingHistory.filter(bill => {
          const billDate = new Date(bill.createdAt);
          return billDate >= date && billDate < nextDate;
        });

        const paid = monthBills
          .filter(bill => bill.status === 'paid')
          .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
        
        const pending = monthBills
          .filter(bill => bill.status === 'pending')
          .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
        
        const failed = monthBills
          .filter(bill => bill.status === 'failed')
          .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);

        monthlyData.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          paid: Math.round(paid * 100) / 100,
          pending: Math.round(pending * 100) / 100,
          failed: Math.round(failed * 100) / 100
        });
      }

      // Calculate weekly data
      const weeklyData = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentWeek = new Date();
      currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());

      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeek);
        date.setDate(date.getDate() + i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayBills = billingHistory.filter(bill => {
          const billDate = new Date(bill.createdAt);
          return billDate >= date && billDate < nextDate;
        });

        const amount = dayBills
          .filter(bill => bill.status === 'paid')
          .reduce((sum, bill) => sum + parseFloat(bill.amount), 0);

        weeklyData.push({
          day: days[i],
          amount: Math.round(amount * 100) / 100
        });
      }

      // Calculate status breakdown for pie chart
      const statusBreakdown = {
        paid: paidAmount._sum.amount || 0,
        pending: pendingAmount._sum.amount || 0,
        failed: failedAmount._sum.amount || 0
      };

      const statusData = [
        { name: 'Paid', value: statusBreakdown.paid, color: '#10B981' },
        { name: 'Pending', value: statusBreakdown.pending, color: '#F59E0B' },
        { name: 'Failed', value: statusBreakdown.failed, color: '#EF4444' }
      ].filter(item => item.value > 0);

      // Calculate growth rate (comparing current month to previous month)
      const currentMonth = monthlyData[monthlyData.length - 1];
      const previousMonth = monthlyData[monthlyData.length - 2];
      
      let monthlyGrowth = 0;
      if (previousMonth && previousMonth.paid > 0) {
        monthlyGrowth = ((currentMonth.paid - previousMonth.paid) / previousMonth.paid) * 100;
      }

      const totalRevenue = summary._sum.amount || 0;
      const totalPaid = paidAmount._sum.amount || 0;
      const totalPending = pendingAmount._sum.amount || 0;
      const totalFailed = failedAmount._sum.amount || 0;
      const transactionCount = summary._count.id || 0;

      res.json({
        success: true,
        data: {
          summary: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalPending: Math.round(totalPending * 100) / 100,
            totalFailed: Math.round(totalFailed * 100) / 100,
            monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
            transactionCount
          },
          charts: {
            monthlyData,
            weeklyData,
            statusData
          }
        }
      });

    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

module.exports = router; 