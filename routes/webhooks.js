const express = require('express');
const crypto = require('crypto');
const BillingIntegrationService = require('../services/billingIntegration');

const router = express.Router();

/**
 * GoCardless Webhook Handler
 * Processes webhook events from GoCardless and updates billing records
 */
router.post('/gocardless', async (req, res) => {
  try {
    console.log('📥 Received GoCardless webhook');
    
    // Verify webhook signature (optional but recommended)
    const signature = req.headers['webhook-signature'];
    const body = JSON.stringify(req.body);
    
    if (process.env.GOCARDLESS_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.GOCARDLESS_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Process webhook events
    const billingIntegration = new BillingIntegrationService();
    const result = await billingIntegration.processGoCardlessWebhook(req.body);
    
    console.log('✅ Webhook processed successfully:', result.events.length, 'events');
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      eventsProcessed: result.events.length
    });

  } catch (error) {
    console.error('❌ Error processing GoCardless webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

/**
 * Zoho Webhook Handler (if needed)
 * Processes webhook events from Zoho Books
 */
router.post('/zoho', async (req, res) => {
  try {
    console.log('📥 Received Zoho webhook');
    
    // Verify webhook signature if configured
    const signature = req.headers['x-zoho-signature'];
    
    if (process.env.ZOHO_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.ZOHO_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Invalid Zoho webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Process Zoho webhook events
    const { events } = req.body;
    
    if (events && events.length > 0) {
      console.log('📋 Processing Zoho events:', events.length);
      
      // Handle different event types
      for (const event of events) {
        switch (event.resource_type) {
          case 'invoices':
            console.log('📄 Invoice event:', event.action, event.resource_id);
            // Handle invoice events (paid, cancelled, etc.)
            break;
          case 'contacts':
            console.log('👤 Contact event:', event.action, event.resource_id);
            // Handle contact events
            break;
          default:
            console.log('❓ Unknown event type:', event.resource_type);
        }
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Zoho webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ Error processing Zoho webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Zoho webhook',
      message: error.message
    });
  }
});

/**
 * Health check endpoint for webhooks
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook service is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 