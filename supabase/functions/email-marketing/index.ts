/**
 * Email Marketing edge function (canonical).
 *
 * Replaces:
 *   server/routes/email-marketing-routes.ts (35 endpoints)
 *   server/services/email-service.ts       (SendGrid → _sendgrid.ts fetch wrapper)
 *
 * Absorbs the existing standalone edge functions:
 *   supabase/functions/email-templates/
 *   supabase/functions/email-campaigns/
 * (they get deleted in PR 2 after 48h soak — same pattern as lead-assignment)
 *
 * URL prefixes handled (frontend paths preserved):
 *   /email-marketing/email-templates/*       → handlers/templates.ts
 *   /email-marketing/email-campaigns/*       → handlers/campaigns.ts
 *   /email-marketing/email-sends/*           → handlers/sends.ts
 *   /email-marketing/email-events            → handlers/events.ts
 *   /email-marketing/email-lists/*           → handlers/lists.ts
 *   /email-marketing/email-list-members/*    → handlers/list-members.ts
 *   /email-marketing/email-unsubscribes/*    → handlers/unsubscribes.ts
 *   /email-marketing/webhooks/sendgrid       → handlers/webhooks-sendgrid.ts (PUBLIC)
 *
 * The /webhooks/sendgrid route is intentionally *unauthenticated* — SendGrid
 * posts here without a JWT. It uses the service-role client to write events.
 *
 * One-time SQL:
 *   \i drizzle/rls/email-marketing-tables.sql
 *   \i drizzle/rls/email-marketing.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleTemplates } from './handlers/templates.ts';
import { handleCampaigns } from './handlers/campaigns.ts';
import { handleSends } from './handlers/sends.ts';
import { handleEvents } from './handlers/events.ts';
import { handleLists } from './handlers/lists.ts';
import { handleListMembers } from './handlers/list-members.ts';
import { handleUnsubscribes } from './handlers/unsubscribes.ts';
import { handleSendgridWebhook } from './handlers/webhooks-sendgrid.ts';

const log = createLogger('email-marketing');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/email-marketing/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();
  const sub = stripPrefix(url.pathname);

  try {
    // Webhook is public — must come before requireAuth.
    if (sub === '/webhooks/sendgrid' && method === 'POST') {
      return await handleSendgridWebhook(req, requestId);
    }

    const auth = await requireAuth(req);
    const db = getDb();

    const pathParts = sub.split('/').filter(Boolean);
    const ctx = { auth, db, requestId, pathParts, method, url };
    const first = pathParts[0];

    let result: Response | null = null;
    switch (first) {
      case 'email-templates':
        result = await handleTemplates(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      case 'email-campaigns':
        result = await handleCampaigns(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      case 'email-sends':
        result = await handleSends(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      case 'email-events':
        result = await handleEvents(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      case 'email-lists':
        result = await handleLists(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      case 'email-list-members':
        result = await handleListMembers(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      case 'email-unsubscribes':
        result = await handleUnsubscribes(req, { ...ctx, pathParts: pathParts.slice(1) });
        break;
      default:
        result = null;
    }

    if (!result) {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }
    return result;
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
