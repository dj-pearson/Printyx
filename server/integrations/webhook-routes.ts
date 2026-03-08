/**
 * Webhook Routes for Real-time Data Synchronization
 * Handles incoming webhooks from all integrated services
 */
import express from 'express';
import { z } from 'zod';
import { WebhookService } from './webhook-service';
import { createModuleLogger } from '../lib/logger';
import { stripSensitiveHeaders } from '../utils/error-sanitizer';
const log = createModuleLogger('webhook-routes');

const router = express.Router();

/** Return a 400 for Zod validation errors, rethrow others */
function handleWebhookError(error: unknown, provider: string, res: express.Response) {
  if (error instanceof z.ZodError) {
    log.warn({ provider, issues: error.issues }, 'Webhook payload validation failed');
    return res.status(400).json({
      error: 'Invalid webhook payload',
      code: 'VALIDATION_ERROR',
      details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  log.error(`Webhook error for ${provider}:`, error);
  return res.status(500).json({ error: 'Internal server error' });
}

// Raw body parser middleware for webhook signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

// ─── Webhook Payload Schemas ──────────────────────────────────────────
// Loose schemas that validate structure without being overly strict,
// since providers may add new fields over time.

const stripeWebhookSchema = z.object({
  id: z.string().startsWith('evt_'),
  object: z.literal('event'),
  type: z.string().min(1),
  data: z.object({ object: z.record(z.unknown()) }),
});

const salesforceWebhookSchema = z.object({
  // Salesforce outbound messages contain sObject data
}).passthrough().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Salesforce webhook payload cannot be empty' },
);

const microsoftGraphWebhookSchema = z.object({
  value: z.array(z.object({
    subscriptionId: z.string(),
    changeType: z.string(),
    resource: z.string(),
  }).passthrough()),
});

const googleCalendarWebhookSchema = z.object({}).passthrough();

const quickbooksWebhookSchema = z.object({
  eventNotifications: z.array(z.object({
    realmId: z.string(),
    dataChangeEvent: z.object({
      entities: z.array(z.object({
        name: z.string(),
        id: z.string(),
        operation: z.string(),
      }).passthrough()),
    }),
  }).passthrough()),
});

/**
 * Generic webhook endpoint that routes to provider-specific handlers
 */
router.post('/api/webhooks/:provider', rawBodyParser, async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = JSON.parse(req.body.toString());
    const headers = req.headers as Record<string, string>;

    log.info(`Received webhook from ${provider}`, {
      headers: stripSensitiveHeaders(headers),
      event: payload?.type || payload?.event || 'unknown',
    });

    const result = await WebhookService.processWebhook(provider, payload, headers);

    if (result.success) {
      res.status(200).json({
        message: result.message,
        processed: result.processed,
      });
    } else {
      res.status(400).json({
        error: result.message,
        details: result.error,
      });
    }
  } catch (error) {
    log.error(`Webhook error for ${req.params.provider}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Salesforce-specific webhook endpoint
 */
router.post('/api/webhooks/salesforce', express.json(), async (req, res) => {
  try {
    const payload = salesforceWebhookSchema.parse(req.body);
    const result = await WebhookService.processWebhook(
      'salesforce',
      payload,
      req.headers as Record<string, string>,
    );

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    handleWebhookError(error, 'salesforce', res);
  }
});

/**
 * Stripe-specific webhook endpoint with raw body parsing for signature verification
 */
router.post('/api/webhooks/stripe', rawBodyParser, async (req, res) => {
  try {
    const raw = JSON.parse(req.body.toString());
    const payload = stripeWebhookSchema.parse(raw);
    const result = await WebhookService.processWebhook(
      'stripe',
      payload,
      req.headers as Record<string, string>,
    );

    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    handleWebhookError(error, 'stripe', res);
  }
});

/**
 * Microsoft Graph webhook endpoint
 */
router.post('/api/webhooks/microsoft-calendar', express.json(), async (req, res) => {
  try {
    // Microsoft Graph webhook validation - must echo back the token
    if (req.query.validationToken) {
      const token = z.string().max(512).parse(req.query.validationToken);
      res.status(200).contentType('text/plain').send(token);
      return;
    }

    const payload = microsoftGraphWebhookSchema.parse(req.body);
    const result = await WebhookService.processWebhook(
      'microsoft-calendar',
      payload,
      req.headers as Record<string, string>,
    );

    if (result.success) {
      res.status(202).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    handleWebhookError(error, 'microsoft-calendar', res);
  }
});

/**
 * Google Calendar webhook endpoint
 */
router.post('/api/webhooks/google-calendar', express.json(), async (req, res) => {
  try {
    const payload = googleCalendarWebhookSchema.parse(req.body);
    const result = await WebhookService.processWebhook(
      'google-calendar',
      payload,
      req.headers as Record<string, string>,
    );

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    handleWebhookError(error, 'google-calendar', res);
  }
});

/**
 * QuickBooks webhook endpoint
 */
router.post('/api/webhooks/quickbooks', rawBodyParser, async (req, res) => {
  try {
    const raw = JSON.parse(req.body.toString());
    const payload = quickbooksWebhookSchema.parse(raw);
    const result = await WebhookService.processWebhook(
      'quickbooks',
      payload,
      req.headers as Record<string, string>,
    );

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    handleWebhookError(error, 'quickbooks', res);
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
      quickbooks: '/api/webhooks/quickbooks',
    },
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
        contentType: 'application/json',
      },
      {
        provider: 'stripe',
        url: '/api/webhooks/stripe',
        method: 'POST',
        contentType: 'application/json',
        notes: 'Requires stripe-signature header',
      },
      {
        provider: 'microsoft-calendar',
        url: '/api/webhooks/microsoft-calendar',
        method: 'POST',
        contentType: 'application/json',
        notes: 'Supports validation token parameter',
      },
      {
        provider: 'google-calendar',
        url: '/api/webhooks/google-calendar',
        method: 'POST',
        contentType: 'application/json',
      },
      {
        provider: 'quickbooks',
        url: '/api/webhooks/quickbooks',
        method: 'POST',
        contentType: 'application/json',
        notes: 'Requires intuit-signature header',
      },
    ],
  });
});

export default router;
