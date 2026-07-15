/**
 * Pure webhook signature verifiers (PA-018).
 *
 * Provider webhook signatures are computed over the RAW request bytes, so the
 * verifier must HMAC the raw body — never `JSON.stringify(parsedPayload)`, whose
 * key order / whitespace / unicode-escaping will differ from what the provider
 * signed and can therefore never match a real signature.
 *
 * These functions are import-light (only Node `crypto`) and pure so they can be
 * unit-tested with real provider-format fixtures.
 */
import crypto from 'crypto';

type RawBody = string | Buffer;

function toBuffer(raw: RawBody): Buffer {
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
}

/** Constant-time compare of two hex/base64 strings; false on length mismatch. */
export function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a Stripe-format signature header (`t=...,v1=...`) over the raw body.
 * The signed payload is `${timestamp}.${rawBody}` — exactly what Stripe signs.
 */
export function verifyStripeSignature(
  rawBody: RawBody,
  signatureHeader: string | undefined,
  secret: string | undefined,
): boolean {
  if (!signatureHeader || !secret) return false;
  const elements = signatureHeader.split(',');
  const signatureHash = elements.find((el) => el.startsWith('v1='))?.slice(3);
  const timestamp = elements.find((el) => el.startsWith('t='))?.slice(2);
  if (!signatureHash || !timestamp) return false;

  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), toBuffer(rawBody)]);
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return safeCompare(signatureHash, expected);
}

/**
 * Verify a plain HMAC-of-raw-body signature (Salesforce hex, QuickBooks base64).
 */
export function verifyHmacSignature(
  rawBody: RawBody,
  signature: string | undefined,
  secret: string | undefined,
  encoding: 'hex' | 'base64',
): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(toBuffer(rawBody)).digest(encoding);
  return safeCompare(signature, expected);
}
