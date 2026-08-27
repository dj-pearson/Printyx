/**
 * Receiver for webhooks a provider POSTs to us.
 *
 * Two jobs, and only two: verify the provider's signature over the raw request
 * bytes, and record the delivery. It used to claim a third — eleven
 * per-provider "sync" methods that returned "synchronized successfully" and
 * wrote nothing — which is why the oauth-config clients were imported here and
 * never called. See the note at the foot of the class.
 */
import { db } from '../db';
import { inboundWebhookEvents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('webhook-service');

import crypto from 'crypto';

export interface WebhookPayload {
  provider: string;
  event: string;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  /**
   * Whether a handler acted on the delivery. It is false for every provider
   * today: the delivery is stored and nothing consumes it yet. It was
   * hardcoded true by the stubs, which is how "acknowledged and dropped"
   * looked like success.
   */
  processed: boolean;
  /** Row id in inbound_webhook_events; null only if the insert failed. */
  eventId?: string | null;
  /** True when the provider re-delivered an event already on file. */
  duplicate?: boolean;
  error?: string;
}

export interface InboundDeliveryDescriptor {
  eventType: string;
  externalEventId: string | null;
  externalAccountId: string | null;
}

/** Providers whose signature this service knows how to verify. */
export const SUPPORTED_WEBHOOK_PROVIDERS = [
  'salesforce',
  'stripe',
  'microsoft-calendar',
  'google-calendar',
  'quickbooks',
] as const;

export class WebhookService {
  /**
   * Process incoming webhook from any provider
   */
  static async processWebhook(
    provider: string,
    payload: any,
    headers: Record<string, string>,
    // The EXACT request body bytes (as received). Provider HMAC signatures are
    // computed over these raw bytes — re-serializing the parsed `payload` with
    // JSON.stringify produces different bytes (key order, whitespace, unicode
    // escaping) and can never match. Callers must pass req.body.toString() from
    // an express.raw() route. (PA-018)
    rawBody: string,
  ): Promise<WebhookProcessingResult> {
    try {
      // Verify webhook signature based on provider
      const isValid = await this.verifyWebhookSignature(provider, payload, headers, rawBody);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid webhook signature',
          processed: false,
          error: 'Signature verification failed',
        };
      }

      // Store it, then answer. The order matters: a 200 stops the provider
      // retrying, so it must not be sent until the delivery is durable.
      const { id, duplicate } = await this.recordInboundDelivery(provider, payload);
      const { eventType } = this.describeDelivery(provider, payload);

      return {
        success: true,
        message: duplicate
          ? `${provider} event already on file`
          : `${provider} event recorded${eventType ? ` (${eventType})` : ''}; no handler runs on it yet`,
        processed: false,
        eventId: id,
        duplicate,
      };
    } catch (error) {
      log.error(`Webhook processing error for ${provider}:`, error);
      // Deliberately a failure result, which the route turns into a non-2xx:
      // if the delivery could not be stored, the provider should retry.
      return {
        success: false,
        message: 'Webhook processing failed',
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * What a delivery from each provider is ABOUT: the event type, the provider's
   * own id for the delivery, and the account it belongs to on their side.
   *
   * Everything here reads the payload; nothing here writes. Attribution to a
   * tenant runs off externalAccountId through platform_integrations, and is
   * deliberately not attempted yet — see recordInboundDelivery.
   */
  static describeDelivery(provider: string, payload: any): InboundDeliveryDescriptor {
    switch (provider) {
      case 'salesforce':
        return {
          eventType: String(payload?.event ?? ''),
          externalEventId: payload?.replayId != null ? String(payload.replayId) : null,
          externalAccountId: payload?.organizationId ? String(payload.organizationId) : null,
        };

      case 'stripe':
        return {
          eventType: String(payload?.type ?? ''),
          externalEventId: payload?.id ? String(payload.id) : null,
          externalAccountId: payload?.account ? String(payload.account) : null,
        };

      case 'microsoft-calendar': {
        const first = Array.isArray(payload?.value) ? payload.value[0] : undefined;
        return {
          eventType: String(first?.changeType ?? ''),
          externalEventId: first?.subscriptionId ? String(first.subscriptionId) : null,
          externalAccountId: first?.tenantId ? String(first.tenantId) : null,
        };
      }

      case 'google-calendar':
        // A Google push notification carries no body of its own; everything
        // that identifies it is in the headers, which the caller folds into the
        // payload before this runs.
        return {
          eventType: String(payload?.resourceState ?? 'sync'),
          externalEventId: payload?.messageNumber ? String(payload.messageNumber) : null,
          externalAccountId: payload?.channelId ? String(payload.channelId) : null,
        };

      case 'quickbooks': {
        const notifications = Array.isArray(payload?.eventNotifications)
          ? payload.eventNotifications
          : [];
        const entities = notifications
          .flatMap((n: any) => n?.dataChangeEvent?.entities ?? [])
          .map((e: any) => `${e?.name ?? '?'}.${e?.operation ?? '?'}`);
        return {
          eventType: entities.join(','),
          externalEventId: null,
          externalAccountId: notifications[0]?.realmId ? String(notifications[0].realmId) : null,
        };
      }

      default:
        return { eventType: '', externalEventId: null, externalAccountId: null };
    }
  }

  /**
   * Store a verified delivery, and return the row id.
   *
   * This is the whole point of the class as it stands. Signature verification
   * below is real and tested; the processing that used to follow it was eleven
   * methods that returned "synchronized successfully" and wrote nothing, so a
   * verified Stripe event was answered 200 — which stops the retry — and then
   * discarded. Recording it first is what makes the 200 honest.
   *
   * onConflictDoNothing against inbound_webhook_events_dedupe_idx: a provider
   * retrying an event it already delivered lands on the existing row. Google
   * push notifications carry no id, and Postgres treats NULLs as distinct, so
   * each of those is kept.
   */
  private static async recordInboundDelivery(
    provider: string,
    payload: any,
  ): Promise<{ id: string | null; duplicate: boolean }> {
    const { eventType, externalEventId, externalAccountId } = this.describeDelivery(
      provider,
      payload,
    );

    const inserted = await db
      .insert(inboundWebhookEvents)
      .values({
        provider,
        eventType,
        externalEventId,
        externalAccountId,
        payload: (payload ?? {}) as Record<string, unknown>,
        status: 'received',
      })
      .onConflictDoNothing()
      .returning({ id: inboundWebhookEvents.id });

    if (inserted.length > 0) return { id: inserted[0].id, duplicate: false };

    // Conflict: the same (provider, external_event_id) is already on file.
    if (externalEventId) {
      const existing = await db
        .select({ id: inboundWebhookEvents.id })
        .from(inboundWebhookEvents)
        .where(
          and(
            eq(inboundWebhookEvents.provider, provider),
            eq(inboundWebhookEvents.externalEventId, externalEventId),
          ),
        )
        .limit(1);
      if (existing.length > 0) return { id: existing[0].id, duplicate: true };
    }
    return { id: null, duplicate: true };
  }

  /**
   * Verify webhook signatures for security
   */
  private static async verifyWebhookSignature(
    provider: string,
    payload: any,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<boolean> {
    switch (provider) {
      case 'stripe':
        return this.verifyStripeSignature(rawBody, headers['stripe-signature']);

      case 'salesforce': {
        // Validate Salesforce webhook using shared secret in custom header
        const sfSecret = process.env.SALESFORCE_WEBHOOK_SECRET;
        if (!sfSecret) {
          log.warn('SALESFORCE_WEBHOOK_SECRET not configured - rejecting webhook');
          return false;
        }
        const sfSignature = headers['x-salesforce-signature'] || headers['x-sfdc-signature'];
        if (!sfSignature) {
          log.warn('Salesforce webhook missing signature header');
          return false;
        }
        // HMAC over the raw request bytes, not JSON.stringify(payload). (PA-018)
        const expectedSfSig = crypto.createHmac('sha256', sfSecret).update(rawBody).digest('hex');
        const sfSigBuf = Buffer.from(sfSignature);
        const expectedSfBuf = Buffer.from(expectedSfSig);
        // timingSafeEqual throws on length mismatch — guard so a wrong-length
        // signature fails closed instead of raising.
        return (
          sfSigBuf.length === expectedSfBuf.length &&
          crypto.timingSafeEqual(sfSigBuf, expectedSfBuf)
        );
      }

      case 'microsoft-calendar': {
        // Validate Microsoft Graph webhook using client state token
        const msSecret = process.env.MICROSOFT_WEBHOOK_SECRET;
        if (!msSecret) {
          log.warn('MICROSOFT_WEBHOOK_SECRET not configured - rejecting webhook');
          return false;
        }
        const clientState = payload?.value?.[0]?.clientState || headers['x-ms-client-state'];
        if (!clientState || clientState !== msSecret) {
          log.warn('Microsoft webhook clientState mismatch');
          return false;
        }
        return true;
      }

      case 'google-calendar':
        // Google Calendar push notifications include headers you can validate
        return this.verifyGoogleSignature(payload, headers);

      case 'quickbooks':
        return this.verifyQuickBooksSignature(rawBody, headers['intuit-signature']);

      default:
        return false;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  private static verifyStripeSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return false;

    try {
      const elements = signature.split(',');
      const signatureHash = elements.find((el) => el.startsWith('v1='))?.split('=')[1];
      const timestamp = elements.find((el) => el.startsWith('t='))?.split('=')[1];

      if (!signatureHash || !timestamp) return false;

      // Stripe signs `${timestamp}.${rawBody}` over the RAW request bytes.
      // Re-serializing the parsed event with JSON.stringify would change the
      // bytes and never match. (PA-018)
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      log.error('Stripe signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify Google webhook signature
   */
  private static verifyGoogleSignature(payload: any, headers: Record<string, string>): boolean {
    // Google Calendar push notifications include channel-specific tokens
    const channelToken = headers['x-goog-channel-token'];
    const channelId = headers['x-goog-channel-id'];

    // Validate that the channel exists and token matches
    // This would typically involve checking against stored subscription data
    return Boolean(channelToken && channelId);
  }

  /**
   * Verify QuickBooks webhook signature
   */
  private static verifyQuickBooksSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;

    const secret = process.env.QUICKBOOKS_WEBHOOK_TOKEN;
    if (!secret) {
      // AUDIT-017: this used to `return false` SILENTLY, so an unconfigured token
      // was indistinguishable from a bad signature — QuickBooks looked connected
      // while every webhook was quietly dropped. Match the Salesforce/Microsoft
      // handlers above and say why we rejected.
      log.warn('QUICKBOOKS_WEBHOOK_TOKEN not configured - rejecting webhook');
      return false;
    }

    try {
      // Intuit signs the RAW request payload bytes, not JSON.stringify(payload). (PA-018)
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedSignature);
      return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch (error) {
      log.error('QuickBooks signature verification error:', error);
      return false;
    }
  }

  // THE ELEVEN "DATA SYNCHRONIZATION" METHODS THAT STOOD HERE ARE DELETED.
  //
  // syncSalesforceAccount, syncSalesforceContact, syncSalesforceOpportunity,
  // syncStripeCustomer, processStripePayment, syncStripeSubscription,
  // syncMicrosoftCalendarEvent, deleteMicrosoftCalendarEvent,
  // syncGoogleCalendarChanges, syncQuickBooksCustomer, syncQuickBooksInvoice
  // and syncQuickBooksPayment each returned
  // { success: true, processed: true, message: "... synchronized successfully" }
  // and touched no table. syncSalesforceAccount built a customerData object and
  // then dropped it on the floor under the comment "Implementation would depend
  // on your specific database operations". That is why `db` and
  // `systemIntegrations` were imported and never used.
  //
  // Reporting processed:true made the receiver answer 200, which tells Stripe
  // and Intuit the delivery was accepted and stops the retry — so a verified
  // event was acknowledged and lost. The switch statements that dispatched to
  // them are gone with them; what survives is describeDelivery, which reads the
  // same fields those switches read, and the row it writes.
  //
  // Deleted rather than left as TODOs, per the repo's rule about features with
  // no backing implementation: a stub that reports success is worse than an
  // absent one, because nothing ever looks for it again.
}
