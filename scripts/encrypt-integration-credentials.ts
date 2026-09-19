#!/usr/bin/env node
/**
 * Re-encrypt the plaintext rows already in `integration_credentials`
 * (SEC-CRED-VAULT-001 AC5).
 *
 * The columns were plaintext from migration 0000 until this story, so a
 * deployment that has ever saved an Apollo key, a DocuSign key or an OAuth
 * token is holding it in the clear. The application tolerates that on read - a
 * value with no `pvc1:` prefix is returned as-is - which keeps every existing
 * integration working, and means a row is only rewritten when somebody happens
 * to save it again. This script does the rest in one pass.
 *
 *   PRINTYX_CREDENTIAL_VAULT_KEY=... DATABASE_URL=... npm run creds:encrypt -- --apply
 *
 * It DRY-RUNS by default and prints what it would change, per tenant and
 * provider, without ever printing a credential. Pass --apply to write.
 *
 * Idempotent: a row already carrying the envelope prefix is skipped, so a
 * second run reports zero. Each row is updated on its own id, so a failure part
 * way through leaves the rows it already converted converted - which is safe
 * precisely because reads accept both formats.
 *
 * WHAT THIS DOES NOT DO: it cannot rotate a key. Re-encrypting under a new
 * master key means decrypting with the old one first, which is a different
 * script and a different deployment procedure.
 */
import process from 'node:process';
import pg from 'pg';
import {
  encryptSecret,
  isEncryptedSecret,
  vaultKeyConfigured,
} from '../server/services/credential-envelope';

const COLUMNS = ['api_key', 'api_secret', 'access_token', 'refresh_token', 'webhook_secret'];

async function main() {
  const apply = process.argv.includes('--apply');

  if (!vaultKeyConfigured()) {
    console.error(
      'PRINTYX_CREDENTIAL_VAULT_KEY (or legacy ADDRESS_BOOK_MASTER_KEY) is not set. Nothing to do.',
    );
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(2);
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
  });
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, tenant_id, provider, ${COLUMNS.join(', ')} FROM integration_credentials ORDER BY tenant_id, provider`,
  );

  let converted = 0;
  let alreadyEncrypted = 0;
  const perProvider = new Map<string, number>();

  for (const row of rows as Record<string, unknown>[]) {
    const updates: Record<string, string> = {};
    for (const col of COLUMNS) {
      const value = row[col] as unknown;
      if (typeof value !== 'string' || value === '') continue;
      if (isEncryptedSecret(value)) {
        alreadyEncrypted += 1;
        continue;
      }
      updates[col] = encryptSecret(value);
    }
    const cols = Object.keys(updates);
    if (cols.length === 0) continue;

    converted += cols.length;
    const key = String(row.provider);
    perProvider.set(key, (perProvider.get(key) ?? 0) + cols.length);

    if (apply) {
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      await client.query(`UPDATE integration_credentials SET ${sets} WHERE id = $1`, [
        row.id as string,
        ...cols.map((c) => updates[c]),
      ]);
    }
  }

  await client.end();

  console.log(`rows scanned:            ${rows.length}`);
  console.log(`values already encrypted: ${alreadyEncrypted}`);
  console.log(`values ${apply ? 'converted' : 'to convert'}:      ${converted}`);
  for (const [provider, n] of [...perProvider].sort()) {
    console.log(`  ${provider}: ${n}`);
  }
  if (!apply && converted > 0) {
    console.log('\nDry run. Re-run with --apply to write.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
