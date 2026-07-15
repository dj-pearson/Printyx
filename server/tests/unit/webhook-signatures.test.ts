import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifyStripeSignature,
  verifyHmacSignature,
  safeCompare,
} from '../../integrations/webhook-signatures';

const SECRET = 'whsec_test_secret';

// Raw body with non-canonical formatting (extra spaces + key order) so that
// JSON.stringify(JSON.parse(raw)) produces a DIFFERENT byte string — this is how
// we prove the verifier must sign the raw bytes, not a re-serialized payload.
const RAW_BODY = '{ "id":  "evt_123" ,  "type": "invoice.paid",  "amount": 4200 }';

function stripeHeader(rawBody: string, timestamp: string, secret: string): string {
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

describe('verifyStripeSignature (PA-018)', () => {
  const header = stripeHeader(RAW_BODY, '1700000000', SECRET);

  it('accepts a signature computed over the raw body', () => {
    expect(verifyStripeSignature(RAW_BODY, header, SECRET)).toBe(true);
    expect(verifyStripeSignature(Buffer.from(RAW_BODY), header, SECRET)).toBe(true);
  });

  it('rejects when verifying against the re-serialized payload (the old bug)', () => {
    // Simulate the previous implementation: HMAC over JSON.stringify(parsed).
    const reSerialized = JSON.stringify(JSON.parse(RAW_BODY));
    expect(reSerialized).not.toBe(RAW_BODY); // formatting differs
    expect(verifyStripeSignature(reSerialized, header, SECRET)).toBe(false);
  });

  it('rejects a tampered body, missing header, or missing secret', () => {
    expect(verifyStripeSignature(RAW_BODY + ' ', header, SECRET)).toBe(false);
    expect(verifyStripeSignature(RAW_BODY, undefined, SECRET)).toBe(false);
    expect(verifyStripeSignature(RAW_BODY, header, undefined)).toBe(false);
    expect(verifyStripeSignature(RAW_BODY, 't=1700000000', SECRET)).toBe(false); // no v1=
  });

  it('rejects a signature made with the wrong secret', () => {
    const badHeader = stripeHeader(RAW_BODY, '1700000000', 'wrong');
    expect(verifyStripeSignature(RAW_BODY, badHeader, SECRET)).toBe(false);
  });
});

describe('verifyHmacSignature (PA-018 Salesforce/QuickBooks)', () => {
  it('validates a hex HMAC over the raw body (Salesforce)', () => {
    const sig = crypto.createHmac('sha256', SECRET).update(RAW_BODY).digest('hex');
    expect(verifyHmacSignature(RAW_BODY, sig, SECRET, 'hex')).toBe(true);
    expect(verifyHmacSignature(JSON.stringify(JSON.parse(RAW_BODY)), sig, SECRET, 'hex')).toBe(
      false,
    );
  });

  it('validates a base64 HMAC over the raw body (QuickBooks)', () => {
    const sig = crypto.createHmac('sha256', SECRET).update(RAW_BODY).digest('base64');
    expect(verifyHmacSignature(RAW_BODY, sig, SECRET, 'base64')).toBe(true);
  });

  it('rejects missing signature or secret', () => {
    expect(verifyHmacSignature(RAW_BODY, undefined, SECRET, 'hex')).toBe(false);
    expect(verifyHmacSignature(RAW_BODY, 'abc', undefined, 'hex')).toBe(false);
  });
});

describe('safeCompare', () => {
  it('is false on length mismatch and true on equal strings', () => {
    expect(safeCompare('abc', 'abcd')).toBe(false);
    expect(safeCompare('abc', 'abc')).toBe(true);
    expect(safeCompare('abc', 'abd')).toBe(false);
  });
});
