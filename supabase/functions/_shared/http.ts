/**
 * HTTP helpers for edge functions — response shape + input validation.
 *
 * Error response matches the existing Express convention:
 *   { message: string, code?: string, details?: unknown, requestId: string }
 *
 * Every response carries an X-Request-ID header for debuggability.
 */

import type { ZodSchema, ZodError } from 'https://esm.sh/zod@3.22.4';
import { getCorsHeaders } from './cors.ts';

/**
 * AUDIT-006: read pagination bounds from the query string.
 *
 * WHY A DEFAULT LIMIT MATTERS: PostgREST silently caps every request at
 * `db-max-rows` (1000 by default). An unpaginated list does NOT error when it
 * exceeds that — it just returns the first 1000 rows, so callers quietly see a
 * truncated list (and any JS-side sum over it is simply WRONG). Always range().
 *
 * Accepts either ?limit=&offset= or ?page=&limit= (1-based page).
 */
export function readRange(
  url: URL,
  opts?: { defaultLimit?: number; maxLimit?: number },
): { limit: number; offset: number } {
  const defaultLimit = opts?.defaultLimit ?? 100;
  const maxLimit = opts?.maxLimit ?? 500;

  const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;

  const rawOffset = parseInt(url.searchParams.get('offset') ?? '', 10);
  if (Number.isFinite(rawOffset) && rawOffset >= 0) return { limit, offset: rawOffset };

  const rawPage = parseInt(url.searchParams.get('page') ?? '', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return { limit, offset: (page - 1) * limit };
}

export function generateRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function baseHeaders(req: Request, requestId: string): Record<string, string> {
  const origin = req.headers.get('origin');
  return {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-ID': requestId,
  };
}

export function jsonResponse(
  data: unknown,
  status: number = 200,
  req: Request,
  requestId: string = generateRequestId(),
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...baseHeaders(req, requestId), ...extraHeaders },
  });
}

export interface ErrorBody {
  message: string;
  code?: string;
  details?: unknown;
  requestId: string;
}

export function errorResponse(
  status: number,
  message: string,
  req: Request,
  opts: {
    code?: string;
    details?: unknown;
    requestId?: string;
  } = {},
): Response {
  const requestId = opts.requestId ?? generateRequestId();
  const body: ErrorBody = {
    message,
    code: opts.code,
    details: opts.details,
    requestId,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(req, requestId),
  });
}

export class ValidationError extends Error {
  constructor(public issues: unknown) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

/**
 * Parse + validate JSON body with a Zod schema. Throws ValidationError if invalid.
 * Caller catches and returns errorResponse(400, ...).
 */
export async function validateBody<T>(schema: ZodSchema<T>, req: Request): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch (err) {
    throw new ValidationError({
      kind: 'invalid_json',
      detail: (err as Error).message,
    });
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError((result.error as ZodError).errors);
  }
  return result.data;
}

/**
 * Parse + validate URL search params with a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>, url: URL): T {
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new ValidationError((result.error as ZodError).errors);
  }
  return result.data;
}
