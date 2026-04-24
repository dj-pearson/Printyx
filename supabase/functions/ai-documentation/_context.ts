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
