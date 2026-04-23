/**
 * Outreach edge function — dispatcher.
 *
 * Routes `/outreach/*` (after the `/outreach` prefix is stripped by Supabase's
 * function router) to handler modules:
 *
 *   GET    /specialties                       → specializations.getSpecialtiesRef
 *   GET    /business-context                  → businessContext.getEffective
 *   GET    /business-context/all              → businessContext.getAll
 *   PUT    /business-context                  → businessContext.upsert
 *   GET    /specializations                   → specializations.getMine
 *   PUT    /specializations                   → specializations.replaceMine
 *   GET    /sequences                         → sequences.list
 *   GET    /sequences/:id                     → sequences.get
 *   POST   /sequences/generate                → sequences.generate
 *   PATCH  /sequences/:id                     → sequences.patch
 *   DELETE /sequences/:id                     → sequences.remove
 *   PATCH  /sequence-steps/:id                → sequences.patchStep
 *   GET    /prospects                         → prospects.list
 *   POST   /prospects                         → prospects.create
 *   PATCH  /prospects/:id                     → prospects.patch
 *   DELETE /prospects/:id                     → prospects.remove
 *   POST   /drafts/generate                   → drafts.generate
 *   GET    /drafts                            → drafts.list
 *   PATCH  /drafts/:id                        → drafts.patch
 *   POST   /drafts/:id/mark-sent              → drafts.markSent
 *   POST   /drafts/:id/mark-replied           → drafts.markReplied
 *   DELETE /drafts/:id                        → drafts.remove
 *
 * Cross-cutting:
 *   - CORS preflight short-circuited in handleCors
 *   - requireAuth runs on every non-OPTIONS path
 *   - OUTREACH_ENABLED_TENANTS env gates access
 *   - Errors funnel through errorResponse for consistent shape
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, ValidationError } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import * as businessContext from './handlers/business-context.ts';
import * as specializations from './handlers/specializations.ts';
import * as sequences from './handlers/sequences.ts';
import * as prospects from './handlers/prospects.ts';
import * as drafts from './handlers/drafts.ts';

import type { HandlerContext } from './_types.ts';

const log = createLogger('outreach');

function stripPrefix(path: string): string {
  // Handle both /outreach/foo and /foo (Supabase may or may not pass the prefix)
  return path.replace(/^\/+/, '/').replace(/^\/outreach/, '') || '/';
}

function tenantEnabled(tenantId: string): boolean {
  const raw = Deno.env.get('OUTREACH_ENABLED_TENANTS') ?? '';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Empty list = allow all (dev default per Phase 2 PRD)
  if (list.length === 0) return true;
  return list.includes(tenantId);
}

export default async function handler(req: Request) {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const startedAt = Date.now();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = stripPrefix(url.pathname);

  log.info({ requestId, method, path }, 'request_received');

  try {
    const ctx = await requireAuth(req, {
      log: (level, msg, extra) =>
        level === 'warn'
          ? log.warn({ requestId, ...extra }, msg)
          : log.info({ requestId, ...extra }, msg),
    });

    if (!tenantEnabled(ctx.tenantId)) {
      return errorResponse(403, 'Outreach is not enabled for your tenant', req, {
        code: 'OUTREACH_NOT_ENABLED',
        requestId,
      });
    }

    const db = getDb();
    const hc: HandlerContext = {
      ctx,
      db,
      log: log.child({ requestId, userId: ctx.userId, tenantId: ctx.tenantId }),
      requestId,
    };

    // ─── Static reference ───────────────────────────────────────────────────
    if (path === '/specialties' && method === 'GET') {
      return await specializations.getSpecialtiesRef(req, hc);
    }

    // ─── Business context ───────────────────────────────────────────────────
    if (path === '/business-context' && method === 'GET') {
      return await businessContext.getEffective(req, hc);
    }
    if (path === '/business-context/all' && method === 'GET') {
      return await businessContext.getAll(req, hc);
    }
    if (path === '/business-context' && method === 'PUT') {
      return await businessContext.upsert(req, hc);
    }

    // ─── Specializations ────────────────────────────────────────────────────
    if (path === '/specializations' && method === 'GET') {
      return await specializations.getMine(req, hc);
    }
    if (path === '/specializations' && method === 'PUT') {
      return await specializations.replaceMine(req, hc);
    }

    // ─── Sequences ──────────────────────────────────────────────────────────
    if (path === '/sequences' && method === 'GET') {
      return await sequences.list(req, hc);
    }
    if (path === '/sequences/generate' && method === 'POST') {
      return await sequences.generate(req, hc);
    }

    const seqMatch = path.match(/^\/sequences\/([^/]+)$/);
    if (seqMatch) {
      const id = seqMatch[1];
      if (method === 'GET') return await sequences.get(req, hc, id);
      if (method === 'PATCH') return await sequences.patch(req, hc, id);
      if (method === 'DELETE') return await sequences.remove(req, hc, id);
    }

    const stepMatch = path.match(/^\/sequence-steps\/([^/]+)$/);
    if (stepMatch && method === 'PATCH') {
      return await sequences.patchStep(req, hc, stepMatch[1]);
    }

    // ─── Prospects ──────────────────────────────────────────────────────────
    if (path === '/prospects' && method === 'GET') {
      return await prospects.list(req, hc);
    }
    if (path === '/prospects' && method === 'POST') {
      return await prospects.create(req, hc);
    }

    const prospectMatch = path.match(/^\/prospects\/([^/]+)$/);
    if (prospectMatch) {
      const id = prospectMatch[1];
      if (method === 'PATCH') return await prospects.patch(req, hc, id);
      if (method === 'DELETE') return await prospects.remove(req, hc, id);
    }

    // ─── Drafts ─────────────────────────────────────────────────────────────
    if (path === '/drafts/generate' && method === 'POST') {
      return await drafts.generate(req, hc);
    }
    if (path === '/drafts' && method === 'GET') {
      return await drafts.list(req, hc);
    }

    const draftMarkSent = path.match(/^\/drafts\/([^/]+)\/mark-sent$/);
    if (draftMarkSent && method === 'POST') {
      return await drafts.markSent(req, hc, draftMarkSent[1]);
    }

    const draftMarkReplied = path.match(/^\/drafts\/([^/]+)\/mark-replied$/);
    if (draftMarkReplied && method === 'POST') {
      return await drafts.markReplied(req, hc, draftMarkReplied[1]);
    }

    const draftMatch = path.match(/^\/drafts\/([^/]+)$/);
    if (draftMatch) {
      const id = draftMatch[1];
      if (method === 'PATCH') return await drafts.patch(req, hc, id);
      if (method === 'DELETE') return await drafts.remove(req, hc, id);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    if (err instanceof ValidationError) {
      return errorResponse(400, 'Validation failed', req, {
        code: 'VALIDATION_ERROR',
        details: err.issues,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info({ requestId, path, method, durationMs: Date.now() - startedAt }, 'request_complete');
  }
}
