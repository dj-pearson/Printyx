import type { AuthContext } from '../_shared/auth.ts';
import type { SupabaseClient } from '../_shared/db.ts';
import type { ResolvedScope } from '../_shared/scope.ts';

export interface HandlerCtx {
  auth: AuthContext;
  db: SupabaseClient;
  /**
   * Resolved ONCE per request in index.ts and passed down, so every handler
   * narrows on the same answer. Recording visibility is a row decision, not a
   * role decision - see _access.ts.
   */
  scope: ResolvedScope;
  requestId: string;
  pathParts: string[];
  method: string;
  url: URL;
}
