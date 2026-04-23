import { AuthContext } from '../_shared/auth.ts';

export interface HandlerCtx {
  auth: AuthContext;
  // deno-lint-ignore no-explicit-any
  db: any;
  requestId: string;
  pathParts: string[];
  method: string;
  url: URL;
}
