/**
 * Webhook Routes for Real-time Data Synchronization
 * Handles incoming webhooks from all integrated services
 */
import express from 'express';
import { WebhookService } from './webhook-service';
import { createModuleLogger } from '../lib/logger';
import { stripSensitiveHeaders } from '../utils/error-sanitizer';
const log = createModuleLogger('webhook-routes');

const router = express.Router();

// Raw body parser middleware for webhook signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

// The five per-provider Zod payload schemas that stood here are gone with the
// handlers that used them (stripe, salesforce, microsoftGraph, googleCalendar,
// quickbooks), along with handleWebhookError, which only they called. The
// generic receiver below does not shape-validate: it hands the raw bytes and the
// parsed payload to WebhookService, which verifies the HMAC first and then
// dispatches. A signature check over the raw body is the stronger gate, and
// re-adding loose passthrough schemas on top of it would only reject payloads
// the provider legitimately extended.

/**
 * Generic webhook endpoint that routes to provider-specific handlers
 */
router.post('/api/webhooks/:provider', rawBodyParser, async (req, res) => {
  try {
    const { provider } = req.params;
    const rawBody = req.body?.toString() ?? '';
    const headers = req.headers as Record<string, string>;

    // A Google Calendar push notification has an EMPTY body — everything that
    // identifies it rides in x-goog-* headers. JSON.parse('') throws, so this
    // route answered 500 to every one of them, which Google reads as a failing
    // endpoint and eventually unsubscribes the channel.
    let payload: any = {};
    if (rawBody.trim() !== '') {
      payload = JSON.parse(rawBody);
    }
    if (provider === 'google-calendar') {
      payload = {
        ...payload,
        channelId: headers['x-goog-channel-id'],
        resourceId: headers['x-goog-resource-id'],
        resourceState: headers['x-goog-resource-state'],
        messageNumber: headers['x-goog-message-number'],
      };
    }

    log.info(`Received webhook from ${provider}`, {
      headers: stripSensitiveHeaders(headers),
      event: payload?.type || payload?.event || payload?.resourceState || 'unknown',
    });

    const result = await WebhookService.processWebhook(provider, payload, headers, rawBody);

    if (result.success) {
      res.status(200).json({
        message: result.message,
        processed: result.processed,
        eventId: result.eventId,
        duplicate: result.duplicate ?? false,
      });
      return;
    }

    // A rejected signature is the caller's problem and will never succeed on a
    // retry, so 400. Anything else means WE failed to store a delivery we
    // accepted responsibility for, and the provider SHOULD retry — answering
    // 400 there would tell it to give up on an event we then do not have.
    const clientError = result.error === 'Signature verification failed';
    res.status(clientError ? 400 : 503).json({
      error: result.message,
      details: result.error,
    });
  } catch (error) {
    log.error(`Webhook error for ${req.params.provider}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// THE FIVE PROVIDER-SPECIFIC HANDLERS THAT STOOD HERE ARE DELETED (PROD-008b).
//
// salesforce, stripe, microsoft-calendar, google-calendar and quickbooks each
// had their own POST route below the generic POST /api/webhooks/:provider above,
// and express matches in registration order, so none of them had ever run.
//
// Deleted rather than reordered, which was the open decision recorded under
// INTEG-WEBHOOK-001, and the evidence is one-sided:
//
//   They are REDUNDANT. The generic handler calls the same
//   WebhookService.processWebhook, which verifies the provider's HMAC
//   (webhook-service.ts:50, tested by server/tests/unit/webhook-signature.test.ts)
//   and then dispatches on the provider name through the same switch the five
//   duplicated. Nothing is lost.
//
//   Two of them were WRONG. microsoft-calendar and google-calendar parsed with
//   express.json() rather than the rawBodyParser, so req.body was a parsed
//   object and the exact bytes the HMAC is computed over were gone - the PA-018
//   trap called out in processWebhook's own signature. Registering them first,
//   the "obvious" fix, would have turned calendar webhooks into signature
//   failures.
//
// What remains on this prefix is the generic receiver, the health probe and the
// outbound list - and all three are still shadowed by the crmProxies entry for
// /api/webhooks. See INTEG-WEBHOOK-001: the receiver cannot simply be
// un-shadowed, because the edge function that owns the prefix authenticates
// before it routes.

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
