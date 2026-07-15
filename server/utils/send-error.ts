/**
 * Shared inline error-response helper (CR-023).
 *
 * Emits the canonical Printyx error shape `{ message, code, details, requestId }`
 * (see CLAUDE.md "Error Format" and server/middleware/error-handler.ts) for the
 * many handlers that build error responses inline with `res.status().json(...)`
 * rather than throwing an AppError. The requestId is read from `req.requestId`
 * (populated by requestIdMiddleware in server/middleware/logging-middleware.ts),
 * so a client can correlate an error with server logs.
 */
import type { Request, Response } from 'express';

/** Default machine-readable code for a status when the caller doesn't pass one. */
export function defaultCodeForStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  }
}

export interface ErrorBody {
  message: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/** Pure builder for the canonical error body (unit-testable without Express). */
export function buildErrorBody(
  statusCode: number,
  message: string,
  code?: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ErrorBody {
  const body: ErrorBody = {
    message,
    code: code ?? defaultCodeForStatus(statusCode),
    requestId,
  };
  if (details !== undefined) body.details = details;
  return body;
}

/**
 * Send a standardized error response. Returns the Response for `return sendError(...)`
 * ergonomics inside handlers.
 */
export function sendError(
  req: Request,
  res: Response,
  statusCode: number,
  message: string,
  code?: string,
  details?: Record<string, unknown>,
): Response {
  const requestId = (req as Request & { requestId?: string }).requestId;
  return res.status(statusCode).json(buildErrorBody(statusCode, message, code, details, requestId));
}
