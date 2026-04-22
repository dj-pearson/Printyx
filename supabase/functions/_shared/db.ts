/**
 * Database client for edge functions.
 *
 * Uses the Supabase JS client — the proven, working path on self-hosted Supabase
 * + Coolify + Deno. Calls go through PostgREST over HTTPS against `SUPABASE_URL`,
 * so they don't hit the Postgres pooler's TLS quirks that break postgres-js/deno-postgres.
 *
 * Drizzle schemas (`shared/**\/*-schema.ts`) remain the single source of truth
 * for table structure and TypeScript types. Import them TYPE-ONLY into edge
 * functions — e.g. `type OutreachSequence = typeof outreachSequences.$inferSelect`.
 *
 * ============================================================================
 *  Two client variants:
 * ============================================================================
 *
 *  getDb()       — SERVICE-ROLE client. Bypasses RLS. Use for most edge function
 *                  queries where you've already authenticated the user and
 *                  filter by `tenant_id` in application code.
 *
 *  getUserDb(jwt) — USER-SCOPED client. Passes the user's JWT through, so RLS
 *                   policies apply. Use as defense-in-depth on top of your
 *                   application-level filtering, or in rare cases where RLS
 *                   alone is sufficient.
 *
 * ============================================================================
 *  Example handler pattern:
 * ============================================================================
 *
 *    import { handleCors } from '../_shared/cors.ts';
 *    import { requireAuth } from '../_shared/auth.ts';
 *    import { getDb } from '../_shared/db.ts';
 *    import { jsonResponse } from '../_shared/http.ts';
 *    import type { OutreachSequence } from '../../../shared/outreach-schema.ts';
 *
 *    const corsResult = handleCors(req);
 *    if (corsResult) return corsResult;
 *
 *    const ctx = await requireAuth(req);
 *    const db = getDb();
 *
 *    const { data, error } = await db
 *      .from('outreach_sequences')
 *      .select('*')
 *      .eq('tenant_id', ctx.tenantId)
 *      .eq('user_id', ctx.userId)
 *      .order('updated_at', { ascending: false });
 *
 *    if (error) throw error;
 *    return jsonResponse({ sequences: data as OutreachSequence[] }, 200, req);
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

let _serviceClient: SupabaseClient | null = null;

function readEnv(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * Application code MUST filter by `tenant_id` explicitly when using this —
 * RLS won't save you if you forget.
 *
 * Cached at module scope; reused across requests in the same Deno instance.
 */
export function getDb(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const url = readEnv('SUPABASE_URL');
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) {
    throw new Error('SUPABASE_URL env var is required for edge function DB access');
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is required for edge function DB access');
  }

  _serviceClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: {
      headers: {
        'x-application-name': 'printyx-edge',
      },
    },
  });

  return _serviceClient;
}

/**
 * User-scoped Supabase client. RLS policies apply.
 *
 * Passes the user's JWT via Authorization header on every request, so
 * PostgREST evaluates policies with the correct `auth.jwt()` claims.
 *
 * NOT cached — each call creates a new client bound to that JWT.
 *
 * Use this when you explicitly want RLS enforcement at the DB layer
 * (e.g. public-facing endpoints where app code might have bugs).
 */
export function getUserDb(jwt: string): SupabaseClient {
  const url = readEnv('SUPABASE_URL');
  const anonKey = readEnv('SUPABASE_ANON_KEY');

  if (!url) throw new Error('SUPABASE_URL env var is required');
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY env var is required');

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

/**
 * Reset the cached service client. For tests only.
 */
export function _resetDbClient(): void {
  _serviceClient = null;
}

/**
 * Re-export SupabaseClient type so handlers can type their local vars
 * without re-importing from esm.sh.
 */
export type { SupabaseClient };
