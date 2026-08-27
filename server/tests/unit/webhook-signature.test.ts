/**
 * Webhook signature verification tests (PA-018).
 *
 * The generic webhook verifier used to HMAC over JSON.stringify(payload) instead
 * of the raw request bytes, so a real provider signature (computed over the raw
 * body) could never validate. These tests use fixtures whose raw bytes DIFFER
 * from their re-serialization, so they pass only against a raw-body HMAC — they
 * would fail against the old JSON.stringify(payload) implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// Avoid DB side effects at import time — the signature verifiers do not touch
// it. The oauth-config mock that stood here is gone with the import: the eleven
// stub sync methods that pulled those clients in never called them either.
vi.mock('../../db', () => ({ db: {} }));

import { WebhookService } from '../../integrations/webhook-service';

// Raw body with insignificant whitespace + a trailing key, so
// JSON.stringify(JSON.parse(rawBody)) produces DIFFERENT bytes.
const RAW_BODY =
  '{"id":"evt_test_1", "object":"event",  "type":"customer.created", "data":{"object":{"id":"cus_123"}}}';
const RESERIALIZED = JSON.stringify(JSON.parse(RAW_BODY));

const svc = WebhookService as unknown as {
  verifyStripeSignature(rawBody: string, signature: string): boolean;
  verifyQuickBooksSignature(rawBody: string, signature: string): boolean;
  verifyWebhookSignature(
    provider: string,
    payload: unknown,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<boolean>;
};

describe('PA-018 webhook signature verification (raw body)', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.SALESFORCE_WEBHOOK_SECRET = 'sf_test_secret';
    process.env.QUICKBOOKS_WEBHOOK_TOKEN = 'qb_test_token';
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('fixture is meaningful: raw bytes differ from re-serialization', () => {
    expect(RAW_BODY).not.toEqual(RESERIALIZED);
  });

  describe('Stripe', () => {
    const timestamp = '1700000000';
    const sign = (body: string) =>
      `t=${timestamp},v1=${crypto
        .createHmac('sha256', 'whsec_test_secret')
        .update(`${timestamp}.${body}`)
        .digest('hex')}`;

    it('validates a signature computed over the RAW body', () => {
      // This is the real Stripe behaviour and the case the old
      // JSON.stringify(payload) code could never satisfy.
      expect(svc.verifyStripeSignature(RAW_BODY, sign(RAW_BODY))).toBe(true);
    });

    it('rejects a signature computed over the re-serialized body', () => {
      expect(svc.verifyStripeSignature(RAW_BODY, sign(RESERIALIZED))).toBe(false);
    });

    it('rejects a missing or malformed signature', () => {
      expect(svc.verifyStripeSignature(RAW_BODY, '')).toBe(false);
      expect(svc.verifyStripeSignature(RAW_BODY, 'garbage')).toBe(false);
    });

    it('rejects when the secret is not configured', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(svc.verifyStripeSignature(RAW_BODY, sign(RAW_BODY))).toBe(false);
    });
  });

  describe('QuickBooks', () => {
    const sign = (body: string) =>
      crypto.createHmac('sha256', 'qb_test_token').update(body).digest('base64');

    it('validates a signature over the RAW body and rejects the re-serialized one', () => {
      expect(svc.verifyQuickBooksSignature(RAW_BODY, sign(RAW_BODY))).toBe(true);
      expect(svc.verifyQuickBooksSignature(RAW_BODY, sign(RESERIALIZED))).toBe(false);
    });
  });

  describe('Salesforce', () => {
    const sign = (body: string) =>
      crypto.createHmac('sha256', 'sf_test_secret').update(body).digest('hex');

    it('validates a signature over the RAW body and rejects the re-serialized one', async () => {
      await expect(
        svc.verifyWebhookSignature(
          'salesforce',
          JSON.parse(RAW_BODY),
          { 'x-salesforce-signature': sign(RAW_BODY) },
          RAW_BODY,
        ),
      ).resolves.toBe(true);
      await expect(
        svc.verifyWebhookSignature(
          'salesforce',
          JSON.parse(RAW_BODY),
          { 'x-salesforce-signature': sign(RESERIALIZED) },
          RAW_BODY,
        ),
      ).resolves.toBe(false);
    });
  });
});
