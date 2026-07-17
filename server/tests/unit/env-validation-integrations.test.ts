/**
 * AUDIT-017 — production fail-loud rules for integration credentials.
 *
 * These exercise the REAL validateEnvironment() (the sibling env-validation.test.ts
 * asserts against a hand-written mock re-implementation, which cannot catch drift
 * between the test and the module it claims to cover).
 *
 * The rule being locked: we never force anyone to configure an integration, but we
 * refuse to let a SELECTED-but-unconfigured provider silently degrade to simulation
 * in production. That mirrors the existing STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET
 * pairing (LAUNCH-014).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnvironment } from '../../lib/env-validation';

const ORIGINAL_ENV = process.env;

/** A minimal, otherwise-valid production env so unrelated rules stay quiet. */
function productionBaseline(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    SESSION_SECRET: 'x'.repeat(48),
    SUPABASE_URL: 'https://api.example.com',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_JWT_SECRET: 'jwt-secret',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  } as NodeJS.ProcessEnv;
}

const hasError = (r: { errors: string[] }, needle: string) =>
  r.errors.some((e) => e.includes(needle));
const hasWarning = (r: { warnings: string[] }, needle: string) =>
  r.warnings.some((w) => w.includes(needle));

beforeEach(() => {
  // The vitest setup file loads the real .env, which would otherwise leak real
  // keys into these assertions. Replace the whole bag per test.
  process.env = productionBaseline();
});
afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('AUDIT-017: email provider fail-loud', () => {
  it('errors when EMAIL_PROVIDER=sendgrid but SENDGRID_API_KEY is missing', () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';
    const r = validateEnvironment();
    expect(hasError(r, 'SENDGRID_API_KEY')).toBe(true);
    expect(r.valid).toBe(false);
  });

  it('does NOT error when sendgrid is fully configured', () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'SG.real-key';
    expect(hasError(validateEnvironment(), 'SENDGRID_API_KEY')).toBe(false);
  });

  it('errors when EMAIL_PROVIDER=resend but RESEND_API_KEY is missing', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    expect(hasError(validateEnvironment(), 'RESEND_API_KEY')).toBe(true);
  });

  it('SEO_RESEND_API_KEY does NOT satisfy the resend requirement (name trap)', () => {
    // SEO_RESEND_API_KEY is documented in .env.example but read by NO code.
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.SEO_RESEND_API_KEY = 're_looks-right-but-is-never-read';
    const r = validateEnvironment();
    expect(hasError(r, 'RESEND_API_KEY')).toBe(true);
  });

  it('errors when EMAIL_PROVIDER=aws-ses but credentials are missing', () => {
    process.env.EMAIL_PROVIDER = 'aws-ses';
    expect(hasError(validateEnvironment(), 'AWS_ACCESS_KEY_ID')).toBe(true);
  });

  it('does not force email config: simulation warns but never errors', () => {
    process.env.EMAIL_PROVIDER = 'simulation';
    const r = validateEnvironment();
    expect(hasWarning(r, 'EMAIL_PROVIDER')).toBe(true);
    expect(hasError(r, 'SENDGRID_API_KEY')).toBe(false);
    expect(hasError(r, 'RESEND_API_KEY')).toBe(false);
  });
});

describe('AUDIT-017: SMS provider fail-loud', () => {
  it('errors listing every missing Twilio var when SMS_PROVIDER=twilio', () => {
    process.env.SMS_PROVIDER = 'twilio';
    const r = validateEnvironment();
    expect(hasError(r, 'TWILIO_ACCOUNT_SID')).toBe(true);
    expect(hasError(r, 'TWILIO_AUTH_TOKEN')).toBe(true);
    expect(hasError(r, 'TWILIO_PHONE_NUMBER')).toBe(true);
  });

  it('does NOT error when Twilio is fully configured', () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_PHONE_NUMBER = '+15555550100';
    expect(hasError(validateEnvironment(), 'TWILIO_')).toBe(false);
  });

  it('TWILIO_FROM_NUMBER alone does not satisfy the Express services', () => {
    // The Express side reads TWILIO_PHONE_NUMBER; only the Deno edge fn reads
    // TWILIO_FROM_NUMBER. Setting just the edge name leaves Express in simulation.
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_FROM_NUMBER = '+15555550100';
    expect(hasError(validateEnvironment(), 'TWILIO_PHONE_NUMBER')).toBe(true);
  });

  it('simulation SMS does not error', () => {
    process.env.SMS_PROVIDER = 'simulation';
    expect(hasError(validateEnvironment(), 'TWILIO_')).toBe(false);
  });
});

describe('AUDIT-017: silent-degradation warnings', () => {
  it('warns when neither credential-vault key is set', () => {
    expect(hasWarning(validateEnvironment(), 'PRINTYX_CREDENTIAL_VAULT_KEY')).toBe(true);
  });

  it('accepts the legacy ADDRESS_BOOK_MASTER_KEY alias', () => {
    process.env.ADDRESS_BOOK_MASTER_KEY = 'legacy-key';
    expect(hasWarning(validateEnvironment(), 'PRINTYX_CREDENTIAL_VAULT_KEY')).toBe(false);
  });

  it('warns for each unset inbound webhook secret', () => {
    const r = validateEnvironment();
    expect(hasWarning(r, 'SALESFORCE_WEBHOOK_SECRET')).toBe(true);
    expect(hasWarning(r, 'MICROSOFT_WEBHOOK_SECRET')).toBe(true);
    expect(hasWarning(r, 'QUICKBOOKS_WEBHOOK_TOKEN')).toBe(true);
  });

  it('stops warning once a webhook secret is set', () => {
    process.env.SALESFORCE_WEBHOOK_SECRET = 'shhh';
    expect(hasWarning(validateEnvironment(), 'SALESFORCE_WEBHOOK_SECRET')).toBe(false);
  });

  it('warns when INTERNAL_CRON_TOKEN is unset (cron endpoints 401 silently)', () => {
    expect(hasWarning(validateEnvironment(), 'INTERNAL_CRON_TOKEN')).toBe(true);
  });
});

describe('AUDIT-017: development is unaffected', () => {
  it('does not apply the production integration rules outside production', () => {
    process.env = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      EMAIL_PROVIDER: 'sendgrid', // selected but unconfigured
      SMS_PROVIDER: 'twilio', // selected but unconfigured
    } as NodeJS.ProcessEnv;
    const r = validateEnvironment();
    expect(hasError(r, 'SENDGRID_API_KEY')).toBe(false);
    expect(hasError(r, 'TWILIO_ACCOUNT_SID')).toBe(false);
  });
});
