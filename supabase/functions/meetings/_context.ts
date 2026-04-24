import type { AuthContext } from '../_shared/auth.ts';
import type { SupabaseClient } from '../_shared/db.ts';

export interface HandlerCtx {
  auth: AuthContext;
  db: SupabaseClient;
  requestId: string;
  pathParts: string[];
  method: string;
  url: URL;
}

/**
 * Strip OAuth token columns from a calendar_connections row. Tokens must
 * never leave the edge function — they're only used server-side to call
 * Google/Microsoft APIs. Same pattern as _shared/credentials.ts from Phase 4.
 */
export function redactConnection<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const key of ['access_token', 'refresh_token', 'sync_token']) {
    if (key in copy) (copy as Record<string, unknown>)[key] = null;
  }
  return copy;
}

export function redactConnections<T extends Record<string, unknown>>(rows: T[] | null): T[] {
  return (rows ?? []).map(redactConnection);
}
