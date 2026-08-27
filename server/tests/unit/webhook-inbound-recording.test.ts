/**
 * INTEG-WEBHOOK-001: the receiver records a verified delivery before it answers.
 *
 * What these lock down is the behaviour the eleven deleted "sync" stubs faked.
 * They returned processed:true and wrote nothing, so the route answered 200 —
 * which tells Stripe and Intuit the event was accepted and stops the retry —
 * and the event was gone. A verified delivery must now reach
 * inbound_webhook_events, and nothing may claim to have processed it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const insertCalls: Array<Record<string, unknown>> = [];
let insertReturns: Array<{ id: string }> = [];
let selectReturns: Array<{ id: string }> = [];

vi.mock('../../db', () => ({
  db: {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        insertCalls.push(row);
        return {
          onConflictDoNothing: () => ({
            returning: async () => insertReturns,
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectReturns,
        }),
      }),
    }),
  },
}));

import { WebhookService } from '../../integrations/webhook-service';

const STRIPE_SECRET = 'whsec_test';

/** A real Stripe signature header over the exact bytes given. */
async function stripeSignature(rawBody: string) {
  const crypto = await import('crypto');
  const timestamp = '1700000000';
  const hash = crypto
    .createHmac('sha256', STRIPE_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `t=${timestamp},v1=${hash}`;
}

beforeEach(() => {
  insertCalls.length = 0;
  insertReturns = [{ id: 'row-1' }];
  selectReturns = [];
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
});

describe('describeDelivery', () => {
  it('reads a Stripe event id, type and connected account', () => {
    expect(
      WebhookService.describeDelivery('stripe', {
        id: 'evt_1',
        type: 'invoice.payment_succeeded',
        account: 'acct_9',
      }),
    ).toEqual({
      eventType: 'invoice.payment_succeeded',
      externalEventId: 'evt_1',
      externalAccountId: 'acct_9',
    });
  });

  it('reads the first entry of a Microsoft Graph notification batch', () => {
    expect(
      WebhookService.describeDelivery('microsoft-calendar', {
        value: [{ changeType: 'updated', subscriptionId: 'sub_2', tenantId: 'ms_tenant' }],
      }),
    ).toEqual({
      eventType: 'updated',
      externalEventId: 'sub_2',
      externalAccountId: 'ms_tenant',
    });
  });

  it('survives a Microsoft notification with no value array', () => {
    expect(WebhookService.describeDelivery('microsoft-calendar', {})).toEqual({
      eventType: '',
      externalEventId: null,
      externalAccountId: null,
    });
  });

  it('flattens QuickBooks entity changes and keeps the realm id', () => {
    expect(
      WebhookService.describeDelivery('quickbooks', {
        eventNotifications: [
          {
            realmId: '4620816',
            dataChangeEvent: {
              entities: [
                { name: 'Customer', operation: 'Create' },
                { name: 'Invoice', operation: 'Update' },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      eventType: 'Customer.Create,Invoice.Update',
      externalEventId: null,
      externalAccountId: '4620816',
    });
  });

  // A Google push carries no body; the route folds the x-goog-* headers in, and
  // resourceState defaults to 'sync' because that is the one Google sends on
  // channel creation with no state of its own.
  it('reads a Google push from the folded-in headers', () => {
    expect(
      WebhookService.describeDelivery('google-calendar', {
        channelId: 'chan_1',
        resourceState: 'exists',
        messageNumber: '12',
      }),
    ).toEqual({
      eventType: 'exists',
      externalEventId: '12',
      externalAccountId: 'chan_1',
    });
  });

  it('returns empty descriptors for a provider it does not know', () => {
    expect(WebhookService.describeDelivery('hubspot', { id: 'x' })).toEqual({
      eventType: '',
      externalEventId: null,
      externalAccountId: null,
    });
  });
});

describe('processWebhook', () => {
  it('stores a verified delivery and reports it as unprocessed', async () => {
    const rawBody = '{"id":"evt_2", "type":"customer.created"}';
    const result = await WebhookService.processWebhook(
      'stripe',
      JSON.parse(rawBody),
      { 'stripe-signature': await stripeSignature(rawBody) },
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.processed).toBe(false);
    expect(result.eventId).toBe('row-1');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      provider: 'stripe',
      eventType: 'customer.created',
      externalEventId: 'evt_2',
      status: 'received',
    });
  });

  it('writes nothing when the signature does not verify', async () => {
    const rawBody = '{"id":"evt_3","type":"customer.created"}';
    const result = await WebhookService.processWebhook(
      'stripe',
      JSON.parse(rawBody),
      { 'stripe-signature': 't=1700000000,v1=' + 'a'.repeat(64) },
      rawBody,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Signature verification failed');
    expect(insertCalls).toHaveLength(0);
  });

  it('writes nothing for a provider with no verifier', async () => {
    const result = await WebhookService.processWebhook('hubspot', {}, {}, '{}');
    expect(result.success).toBe(false);
    expect(insertCalls).toHaveLength(0);
  });

  // The provider re-delivering an event it already sent must land on the row
  // already on file, not a second one.
  it('resolves a re-delivery to the existing row', async () => {
    insertReturns = [];
    selectReturns = [{ id: 'row-existing' }];

    const rawBody = '{"id":"evt_4","type":"customer.created"}';
    const result = await WebhookService.processWebhook(
      'stripe',
      JSON.parse(rawBody),
      { 'stripe-signature': await stripeSignature(rawBody) },
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.eventId).toBe('row-existing');
  });

  // The conflict-then-empty-lookup path. It should report a null id rather
  // than invent one, so a caller can tell "stored" from "we do not know".
  it('reports a null event id when the row cannot be resolved', async () => {
    insertReturns = [];
    selectReturns = [];
    const rawBody = '{"id":"evt_5","type":"customer.created"}';
    const signature = await stripeSignature(rawBody);

    // No id on file and no row returned: the service reports a duplicate with a
    // null id rather than inventing one.
    const result = await WebhookService.processWebhook(
      'stripe',
      JSON.parse(rawBody),
      { 'stripe-signature': signature },
      rawBody,
    );
    expect(result.eventId).toBeNull();
  });
});
