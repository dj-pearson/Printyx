/**
 * The two runtimes must read each other's ciphertext (SEC-CRED-VAULT-001 AC2).
 *
 * A credential saved through the apollo edge function (Deno) is read by Express
 * through server/apollo-client.ts (Node). Before this story the two vaults
 * could not have exchanged a value if they had tried: one returned
 * { blob, v: 1 }, the other three separate Buffers, and they resolved different
 * env vars. Asserting that both "use AES-256-GCM" would prove nothing, so every
 * test below encrypts on one side and decrypts on the other.
 *
 * The Deno module is imported with a globalThis.Deno stub - it only uses
 * standard Web Crypto, btoa/atob and Deno.env.get, all of which Node 20 has or
 * can be handed.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CREDENTIAL_FIELDS,
  ENVELOPE_PREFIX,
  _resetMasterKeyCache,
  encryptCredentialFields,
  encryptSecret,
  isEncryptedSecret,
  readSecret,
  vaultKeyConfigured,
} from '../../services/credential-envelope';

const KEY = randomBytes(32).toString('base64');

type DenoEnvelope = typeof import('../../../supabase/functions/_shared/credential-envelope.ts');
let deno: DenoEnvelope;

beforeAll(async () => {
  (globalThis as Record<string, unknown>).Deno = {
    env: { get: (name: string) => (name === 'PRINTYX_CREDENTIAL_VAULT_KEY' ? KEY : undefined) },
  };
  process.env.PRINTYX_CREDENTIAL_VAULT_KEY = KEY;
  deno = await import('../../../supabase/functions/_shared/credential-envelope.ts');
});

afterEach(() => {
  process.env.PRINTYX_CREDENTIAL_VAULT_KEY = KEY;
  _resetMasterKeyCache();
});

describe('one envelope, two runtimes', () => {
  it('Node decrypts what Deno wrote', async () => {
    const written = await deno.encryptSecret('apollo-live-key-9f2c');
    expect(readSecret(written)).toBe('apollo-live-key-9f2c');
  });

  it('Deno decrypts what Node wrote', async () => {
    const written = encryptSecret('apollo-live-key-9f2c');
    expect(await deno.readSecret(written)).toBe('apollo-live-key-9f2c');
  });

  it('survives a non-ASCII secret in both directions', async () => {
    // A webhook secret is arbitrary bytes as far as we are concerned; a
    // Latin-1-only base64 helper would mangle this and the round trip is the
    // only thing that says so.
    const secret = 'clé-secrète-日本語-\u{1F510}';
    expect(readSecret(await deno.encryptSecret(secret))).toBe(secret);
    expect(await deno.readSecret(encryptSecret(secret))).toBe(secret);
  });

  it('agrees on the prefix and the column list', () => {
    expect(deno.ENVELOPE_PREFIX).toBe(ENVELOPE_PREFIX);
    expect([...deno.CREDENTIAL_COLUMNS]).toEqual([
      'api_key',
      'api_secret',
      'access_token',
      'refresh_token',
      'webhook_secret',
    ]);
    expect(CREDENTIAL_FIELDS.length).toBe(deno.CREDENTIAL_COLUMNS.length);
  });

  it('refuses a tampered blob rather than returning garbage', () => {
    const written = encryptSecret('apollo-live-key-9f2c');
    const raw = Buffer.from(written.slice(ENVELOPE_PREFIX.length), 'base64');
    raw[raw.length - 1] ^= 0xff; // flip a bit of the auth tag
    expect(() => readSecret(ENVELOPE_PREFIX + raw.toString('base64'))).toThrow(/auth tag|failed/i);
  });

  it('two encryptions of the same secret differ', () => {
    // A deterministic ciphertext would leak that two tenants pasted the same
    // key, and GCM with a reused IV is worse than that.
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });
});

describe('legacy plaintext is tolerated on read, never written', () => {
  it('a value with no prefix comes back as itself', async () => {
    expect(readSecret('plain-apollo-key')).toBe('plain-apollo-key');
    expect(await deno.readSecret('plain-apollo-key')).toBe('plain-apollo-key');
  });

  it('null and empty are null, not the empty string', () => {
    expect(readSecret(null)).toBeNull();
    expect(readSecret(undefined)).toBeNull();
    expect(readSecret('')).toBeNull();
  });

  it('isEncryptedSecret keys off the prefix, not the shape', () => {
    // An Apollo key is hex; a base64-looking value is not evidence of anything.
    expect(isEncryptedSecret('YXBvbGxvLWtleQ==')).toBe(false);
    expect(isEncryptedSecret(encryptSecret('x'))).toBe(true);
  });

  it('re-encrypting an already-encrypted value is a no-op', () => {
    const once = encryptSecret('k');
    expect(encryptCredentialFields({ apiKey: once }).apiKey).toBe(once);
  });
});

describe('a write with no master key fails closed', () => {
  it('encryptSecret throws instead of returning plaintext', () => {
    delete process.env.PRINTYX_CREDENTIAL_VAULT_KEY;
    delete process.env.ADDRESS_BOOK_MASTER_KEY;
    _resetMasterKeyCache();
    expect(vaultKeyConfigured()).toBe(false);
    expect(() => encryptSecret('k')).toThrow(/PRINTYX_CREDENTIAL_VAULT_KEY/);
  });

  it('but a read of a legacy plaintext row still works without one', () => {
    delete process.env.PRINTYX_CREDENTIAL_VAULT_KEY;
    delete process.env.ADDRESS_BOOK_MASTER_KEY;
    _resetMasterKeyCache();
    expect(readSecret('plain-apollo-key')).toBe('plain-apollo-key');
  });
});

describe('the field mapper', () => {
  it('encrypts every secret field and nothing else', () => {
    const row = encryptCredentialFields({
      apiKey: 'a',
      apiSecret: 'b',
      accessToken: 'c',
      refreshToken: 'd',
      webhookSecret: 'e',
      accountId: 'acct-1',
      integrationName: 'Apollo.io',
    });
    for (const f of CREDENTIAL_FIELDS) expect(isEncryptedSecret(row[f])).toBe(true);
    expect(row.accountId).toBe('acct-1');
    expect(row.integrationName).toBe('Apollo.io');
  });

  it('leaves an absent or empty field alone', () => {
    const row = encryptCredentialFields({ apiKey: 'a', apiSecret: '', accessToken: null });
    expect(isEncryptedSecret(row.apiKey)).toBe(true);
    expect(row.apiSecret).toBe('');
    expect(row.accessToken).toBeNull();
  });
});

describe('the schema comment is no longer a lie', () => {
  it('names the envelope module instead of claiming encryption happens somewhere', () => {
    const schema = readFileSync(join(process.cwd(), 'shared/schema.ts'), 'utf8');
    const table = schema.slice(
      schema.indexOf('export const integrationCredentials = pgTable('),
      schema.indexOf('export const signatureRequests'),
    );
    expect(table).toContain('credential-envelope');
    expect(table).not.toContain('encrypted at application level');
  });
});

describe('redaction matched camelCase while PostgREST returns snake_case', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/functions/_shared/credentials.ts'),
    'utf8',
  );

  it('compares key names with separators removed', () => {
    expect(src).toContain('function normalizeKey');
    expect(src).not.toMatch(/keySet\.has\(key\.toLowerCase\(\)\)/);
  });

  it('redacts api_key, not just apiKey', async () => {
    const { redactCredentials } = await import(
      '../../../supabase/functions/_shared/credentials.ts'
    );
    const row = redactCredentials({
      id: 'c-1',
      provider: 'docusign',
      api_key: 'dk_live_secret',
      access_token: 'at_secret',
      webhook_secret: 'wh_secret',
      integration_name: 'DocuSign Production',
    });
    expect(row.api_key).not.toContain('secret');
    expect(row.access_token).not.toContain('secret');
    expect(row.webhook_secret).not.toContain('secret');
    expect(row.integration_name).toBe('DocuSign Production');
    expect(row.provider).toBe('docusign');
  });

  it('still leaves an unset field unset, so the UI can say "not configured"', async () => {
    const { redactCredentials } = await import(
      '../../../supabase/functions/_shared/credentials.ts'
    );
    const row = redactCredentials({ api_key: null, api_secret: '' });
    expect(row.api_key).toBeNull();
    expect(row.api_secret).toBe('');
  });
});

describe('the writers that had to change', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  const code = (p: string) =>
    read(p)
      .split('\n')
      .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');

  it('the apollo edge function encrypts on save and decrypts on read', () => {
    const fn = code('supabase/functions/apollo/index.ts');
    expect(fn).toContain('await encryptSecret(apiKey)');
    expect(fn).toContain('api_key: await readSecret(');
    // The old plaintext write is gone from both branches.
    expect(fn).not.toMatch(/api_key:\s*apiKey,/);
  });

  it('a save with no master key answers 503, not 500 and not success', () => {
    const fn = code('supabase/functions/apollo/index.ts');
    const branch = fn.slice(fn.indexOf('encryptSecret(apiKey)'));
    expect(branch.slice(0, 900)).toContain('503');
    expect(branch.slice(0, 900)).toContain('PRINTYX_CREDENTIAL_VAULT_KEY');
  });

  it('Express writes through storage, which encrypts for every caller', () => {
    const storage = code('server/storage.ts');
    expect(storage).toContain('encryptCredentialFields(credential)');
    expect(storage).toContain('...encryptCredentialFields(credential)');
  });

  it('server/apollo-client.ts reads what the edge function wrote', () => {
    const client = code('server/apollo-client.ts');
    expect(client).toContain('readSecret(credential.apiKey)');
    expect(client).not.toContain('new ApolloClient(credential.apiKey');
  });
});
