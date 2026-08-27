/**
 * The API error contract, Express side (CR-023).
 *
 * CLAUDE.md documents one shape for every error this API returns:
 *
 *   { "message": "...", "code": "ERROR_CODE", "details": {}, "requestId": "uuid" }
 *
 * The edge functions have emitted it for a while through
 * `supabase/functions/_shared/http.ts` errorResponse(). Express has not: roughly
 * 1,900 handlers answer with `{ error: '...' }` and 1,300 with a bare
 * `{ message: '...' }`, so a client cannot branch on `code` and a support
 * request cannot be tied to a log line. `globalErrorHandler` already produces
 * the right shape, but only for errors that are THROWN — a handler that calls
 * res.status(500).json(...) itself never reaches it.
 *
 * This is the twin of the Deno helper, locked to it by
 * server/tests/unit/error-response-parity.test.ts.
 */
import type { Response } from 'express';
import { randomUUID } from 'crypto';

/** Exactly the keys CLAUDE.md specifies, in that order. */
export interface ApiErrorBody {
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

export interface ErrorOptions {
  code?: string;
  details?: unknown;
  /** Falls back to req.requestId via res.locals, then to a fresh id. */
  requestId?: string;
}

export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Builds the body without touching the response, so it can be tested and reused
 * by anything that needs the shape (the global handler, a proxy, a test).
 *
 * `details` is omitted rather than set to undefined when absent: JSON.stringify
 * drops undefined keys anyway, and being explicit keeps the two implementations
 * comparable key-for-key.
 */
export function buildErrorBody(message: string, opts: ErrorOptions = {}): ApiErrorBody {
  const body: ApiErrorBody = { message };
  if (opts.code !== undefined) body.code = opts.code;
  if (opts.details !== undefined) body.details = opts.details;
  body.requestId = opts.requestId ?? generateRequestId();
  return body;
}

/**
 * Sends an error in the documented shape and sets X-Request-Id.
 *
 * Prefers the request's own id when one is already attached, so the body, the
 * header and the access log all name the same request. That is the whole point
 * of the field: without it a 500 in a user's screenshot cannot be found in a log.
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  opts: ErrorOptions = {},
): Response {
  const requestId =
    opts.requestId ??
    (res.req as { requestId?: string } | undefined)?.requestId ??
    (res.locals?.requestId as string | undefined) ??
    generateRequestId();

  const body = buildErrorBody(message, { ...opts, requestId });
  if (!res.getHeader('X-Request-Id')) res.setHeader('X-Request-Id', requestId);
  return res.status(status).json(body);
}

/** Common shapes, so a code string is not retyped at 1,900 call sites. */
export const badRequest = (res: Response, message: string, opts?: ErrorOptions) =>
  sendError(res, 400, message, { code: 'BAD_REQUEST', ...opts });

export const unauthorized = (res: Response, message = 'Authentication required') =>
  sendError(res, 401, message, { code: 'UNAUTHENTICATED' });

export const forbidden = (res: Response, message = 'Insufficient permissions') =>
  sendError(res, 403, message, { code: 'FORBIDDEN' });

export const notFound = (res: Response, message = 'Not found') =>
  sendError(res, 404, message, { code: 'NOT_FOUND' });

export const serverError = (
  res: Response,
  message = 'Internal server error',
  opts?: ErrorOptions,
) => sendError(res, 500, message, { code: 'INTERNAL_ERROR', ...opts });
