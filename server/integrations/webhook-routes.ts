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

/**
 * The inbound receiver, on its own router so it can be mounted BEFORE the edge
 * function proxy (INTEG-WEBHOOK-001, last AC: "the proxy entry is narrowed").
 *
 * /api/webhooks is in crmProxies, the proxy registers at routes-registry:297
 * and this file's router mounted at :401, so the proxy won and every inbound
 * delivery went to supabase/functions/webhooks/ - which calls auth.getUser()
 * before it routes anything. A provider sends no JWT, so Stripe, Google
 * Calendar and the rest got 401. The proxy falls through only on a NETWORK
 * error, never on a 401, so nothing reached the code below.
 *
 * Removing the crmProxies entry would be the wrong fix: the edge function
 * legitimately owns the OUTBOUND webhook management surface (list, create,
 * test, regenerate-secret, logs). The two surfaces do not actually collide -
 * the edge function has POST / (create), POST /:id/test and
 * POST /:id/regenerate-secret, and NO POST /:id branch - so
 * `POST /api/webhooks/<provider>` is unambiguously this receiver's shape and is
 * the only thing mounted early.
 *
 * The health probe and the outbound list further down stay shadowed on purpose;
 * the edge function serves both.
 */
export const inboundWebhookReceiver = express.Router();

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
inboundWebhookReceiver.post('/api/webhooks/:provider', rawBodyParser, async (req, res) => {
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
// What remained on this prefix was the generic receiver, a health probe and an
// outbound list. The receiver is NO LONGER SHADOWED: it lives on
// inboundWebhookReceiver above, which routes-registry mounts before the proxy.
// The earlier note here said it "cannot simply be un-shadowed, because the edge
// function that owns the prefix authenticates before it routes" - that is the
// reason the whole prefix could not be un-proxied, not a reason the one POST
// could not be mounted ahead of it.
//
// The other two are GONE. The outbound list was a straight duplicate of the
// edge function's GET / branch. The health probe was NOT, despite an earlier
// version of this comment claiming the edge function served both: that function
// has no health route, so GET /api/webhooks/health fell into its
// `GET /:id` branch and looked up a webhook whose id is the string "health",
// returning 404. It had no caller anywhere in the repo either - client, server
// or k8s - so it had been a probe that could only fail, answering an outage it
// did not have.

router.use(inboundWebhookReceiver);

export default router;
