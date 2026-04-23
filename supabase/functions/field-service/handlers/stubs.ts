// ETAs and other endpoints whose backing tables don't exist in migration 0000.
//
// Paths:
//   /etas                              — GET list (empty)
//   /etas/:id                          — GET/PATCH/POST (501)
//   /tickets/:id/eta                   — GET (null)
//   /technicians/:id/eta-accuracy      — GET (static)

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleStubs(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, requestId } = ctx;

  if (pathParts[0] === 'etas' && method === 'GET' && !pathParts[1]) {
    return jsonResponse(
      {
        stub: true,
        etas: [],
        message: 'ETAs require a technician_etas table — deferred to follow-up.',
      },
      200,
      req,
      requestId,
    );
  }

  if (pathParts[0] === 'etas' && pathParts[1]) {
    return errorResponse(501, 'ETAs not yet persisted', req, {
      code: 'NOT_IMPLEMENTED',
      details: 'Requires technician_etas table — deferred.',
      requestId,
    });
  }

  return null;
}
