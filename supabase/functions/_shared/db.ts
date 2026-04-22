/**
 * Drizzle ORM client for edge functions.
 *
 * Uses postgres-js (Deno-compatible) against the self-hosted Supabase Postgres pooler.
 * The client is cached at module scope so it's reused across requests in the same
 * Deno instance — that keeps connection count low and cold-start cost contained.
 *
 * Requires env vars:
 *   DATABASE_URL                     — full postgres:// connection string
 *   DB_SSL_REJECT_UNAUTHORIZED       — "false" to accept self-signed certs (default: "false")
 *   DB_POOL_MAX                      — max pool size per instance (default: 2)
 *   DB_CONNECTION_LIFETIME_SECONDS   — force reconnect after N seconds (default: 600)
 *
 * Usage:
 *   import { getDb } from '../_shared/db.ts';
 *   const db = getDb();
 *   const rows = await db.select().from(someTable).where(...);
 *
 * Drizzle is imported via esm.sh (no import map required). Version-pinned to match
 * the package.json version so schema types line up 1:1 with the Node side.
 */

import postgres from 'https://esm.sh/postgres@3.4.3';
import { drizzle, type PostgresJsDatabase } from 'https://esm.sh/drizzle-orm@0.29.4/postgres-js';

let _client: ReturnType<typeof postgres> | null = null;
let _db: PostgresJsDatabase | null = null;

function readEnv(name: string, fallback?: string): string | undefined {
  try {
    return Deno.env.get(name) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getDb(): PostgresJsDatabase {
  if (_db) return _db;

  const connectionString = readEnv('DATABASE_URL');
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL env var is required for edge function DB access. Set it in Coolify.',
    );
  }

  const rejectUnauthorized = readEnv('DB_SSL_REJECT_UNAUTHORIZED', 'false') === 'true';
  const maxPool = parseInt(readEnv('DB_POOL_MAX', '2') ?? '2', 10);

  // SSL strategy (override with DB_SSL_MODE env var):
  //   'disable'  → no TLS (plaintext socket)
  //   'require'  → TLS, accept any cert (best for self-signed Supabase) — DEFAULT
  //   'verify'   → TLS with full cert verification
  //   'object'   → custom { rejectUnauthorized: false } — legacy behavior
  const sslMode = (readEnv('DB_SSL_MODE', 'require') ?? 'require').toLowerCase();
  let sslConfig: any;
  if (sslMode === 'disable' || connectionString.includes('sslmode=disable')) {
    sslConfig = false;
  } else if (sslMode === 'verify' || rejectUnauthorized) {
    sslConfig = true;
  } else if (sslMode === 'object') {
    sslConfig = { rejectUnauthorized: false };
  } else {
    sslConfig = 'require';
  }

  _client = postgres(connectionString, {
    max: maxPool,
    // Supabase pooler runs in transaction mode by default — prepared statements
    // don't survive across transactions, so disable them.
    prepare: false,
    ssl: sslConfig,
    onnotice: () => {}, // suppress NOTICE-level chatter
  });

  _db = drizzle(_client);
  return _db;
}

/**
 * Tear down the pool. Mainly useful in tests; edge function instances are ephemeral
 * so you rarely need this in production.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = null;
    _db = null;
  }
}

/**
 * For ad-hoc raw SQL that doesn't fit the Drizzle query builder. Prefer Drizzle
 * query builders when possible for type safety.
 */
export function getRawClient(): ReturnType<typeof postgres> {
  if (!_client) getDb();
  return _client!;
}
