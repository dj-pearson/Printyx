/**
 * Shared types for outreach handlers.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import type { AuthContext } from '../_shared/auth.ts';
import type { Logger } from '../_shared/logger.ts';

export interface HandlerContext {
  ctx: AuthContext;
  db: SupabaseClient;
  log: Logger;
  requestId: string;
}

export type HandlerFn = (req: Request, hc: HandlerContext) => Promise<Response>;
