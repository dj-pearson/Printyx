// Shared request-scoped context for all lead-assignment handlers.

import { AuthContext } from '../_shared/auth.ts';

export interface HandlerCtx {
  auth: AuthContext;
  // deno-lint-ignore no-explicit-any
  db: any;
  requestId: string;
  // Path parts already stripped of the canonical prefix.
  pathParts: string[];
  method: string;
  url: URL;
}
