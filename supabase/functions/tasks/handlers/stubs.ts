// Stubs — endpoints whose backing tables don't exist in migration 0000.
//
// Paths:
//   GET  /categories                 — static list (no task_categories table)
//   GET  /suggestions                — empty array (no task_suggestions table)
//   POST /suggestions/:id/accept     — 501 acknowledgement
//   POST /schedule                   — 501 (no task_schedules table + no cron integration)
//
// When the data model catches up, replace these with real handlers. Each
// response includes `stub: true` so the frontend can surface "feature pending"
// UI if desired.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

// Static list — matches the Express enum the frontend consumes.
const CATEGORIES = [
  { id: 'installation', name: 'Installation', color: '#3b82f6' },
  { id: 'maintenance', name: 'Maintenance', color: '#f59e0b' },
  { id: 'repair', name: 'Repair', color: '#ef4444' },
  { id: 'administrative', name: 'Administrative', color: '#64748b' },
  { id: 'customer_follow_up', name: 'Customer Follow-up', color: '#10b981' },
  { id: 'internal', name: 'Internal', color: '#8b5cf6' },
];

export async function handleStubs(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, requestId } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];

  if (first === 'categories' && method === 'GET') {
    return jsonResponse({ categories: CATEGORIES, stub: true }, 200, req, requestId);
  }

  if (first === 'suggestions' && method === 'GET') {
    return jsonResponse(
      {
        suggestions: [],
        stub: true,
        message: 'Task suggestions require a task_suggestions table — deferred to follow-up.',
      },
      200,
      req,
      requestId,
    );
  }

  if (first === 'suggestions' && second && pathParts[2] === 'accept' && method === 'POST') {
    return errorResponse(501, 'Task suggestions not yet implemented', req, {
      code: 'NOT_IMPLEMENTED',
      details: { stub: true, reason: 'no task_suggestions table' },
      requestId,
    });
  }

  if (first === 'schedule' && method === 'POST') {
    return errorResponse(501, 'Task scheduling not yet implemented', req, {
      code: 'NOT_IMPLEMENTED',
      details: {
        stub: true,
        reason:
          'Recurring-task generation needs a task_schedules table + pg_cron integration (Phase 6 US-026).',
      },
      requestId,
    });
  }

  return null;
}
