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
