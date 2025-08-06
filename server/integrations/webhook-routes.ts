/**
 * Webhook Routes for Real-time Data Synchronization
 * Handles incoming webhooks from all integrated services
 */
import express from 'express';
import { WebhookService } from './webhook-service';

const router = express.Router();

// Raw body parser middleware for webhook signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

/**
 * Generic webhook endpoint that routes to provider-specific handlers
 */
router.post('/api/webhooks/:provider', rawBodyParser, async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = JSON.parse(req.body.toString());
    const headers = req.headers as Record<string, string>;

    console.log(`Received webhook from ${provider}:`, {
      headers: headers,
      payload: JSON.stringify(payload, null, 2)
    });

    const result = await WebhookService.processWebhook(provider, payload, headers);

    if (result.success) {
      res.status(200).json({
        message: result.message,
        processed: result.processed
      });
    } else {
      res.status(400).json({
        error: result.message,
        details: result.error
      });
    }
  } catch (error) {
    console.error(`Webhook error for ${req.params.provider}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Salesforce-specific webhook endpoint
 */
router.post('/api/webhooks/salesforce', express.json(), async (req, res) => {
  try {
    const result = await WebhookService.processWebhook('salesforce', req.body, req.headers as Record<string, string>);
    
    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Salesforce webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Stripe-specific webhook endpoint with raw body parsing for signature verification
 */
router.post('/api/webhooks/stripe', rawBodyParser, async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const result = await WebhookService.processWebhook('stripe', payload, req.headers as Record<string, string>);
    
    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Invalid payload' });
  }
});

/**
 * Microsoft Graph webhook endpoint
 */
router.post('/api/webhooks/microsoft-calendar', express.json(), async (req, res) => {
  try {
    // Microsoft Graph webhook validation
    if (req.query.validationToken) {
      // Return validation token for subscription setup
      res.status(200).send(req.query.validationToken);
      return;
    }

    const result = await WebhookService.processWebhook('microsoft-calendar', req.body, req.headers as Record<string, string>);
    
    if (result.success) {
      res.status(202).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Microsoft webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Google Calendar webhook endpoint
 */
router.post('/api/webhooks/google-calendar', express.json(), async (req, res) => {
  try {
    const result = await WebhookService.processWebhook('google-calendar', req.body, req.headers as Record<string, string>);
    
    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Google Calendar webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * QuickBooks webhook endpoint
 */
router.post('/api/webhooks/quickbooks', rawBodyParser, async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const result = await WebhookService.processWebhook('quickbooks', payload, req.headers as Record<string, string>);
    
    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('QuickBooks webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Webhook health check endpoint
 */
router.get('/api/webhooks/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    webhooks: {
      salesforce: '/api/webhooks/salesforce',
      stripe: '/api/webhooks/stripe',
      'microsoft-calendar': '/api/webhooks/microsoft-calendar',
      'google-calendar': '/api/webhooks/google-calendar',
      quickbooks: '/api/webhooks/quickbooks'
    }
  });
});

/**
 * List webhook endpoints for debugging
 */
router.get('/api/webhooks', (req, res) => {
  res.status(200).json({
    endpoints: [
      {
        provider: 'salesforce',
        url: '/api/webhooks/salesforce',
        method: 'POST',
        contentType: 'application/json'
      },
      {
        provider: 'stripe',
        url: '/api/webhooks/stripe',
        method: 'POST',
        contentType: 'application/json',
        notes: 'Requires stripe-signature header'
      },
      {
        provider: 'microsoft-calendar',
        url: '/api/webhooks/microsoft-calendar',
        method: 'POST',
        contentType: 'application/json',
        notes: 'Supports validation token parameter'
      },
      {
        provider: 'google-calendar',
        url: '/api/webhooks/google-calendar',
        method: 'POST',
        contentType: 'application/json'
      },
      {
        provider: 'quickbooks',
        url: '/api/webhooks/quickbooks',
        method: 'POST',
        contentType: 'application/json',
        notes: 'Requires intuit-signature header'
      }
    ]
  });
});

export default router;