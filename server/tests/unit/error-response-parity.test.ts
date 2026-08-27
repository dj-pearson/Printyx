// CR-023 parity lock for the API error contract.
//
// CLAUDE.md specifies one shape for every error this API returns:
//   { message, code, details, requestId }
//
// The edge functions have emitted it through _shared/http.ts errorResponse();
// Express had no equivalent, so ~1,900 handlers answered with { error } and
// ~1,300 with a bare { message }. A client cannot branch on a code that is not
// there, and a 500 in a screenshot cannot be found in a log without the id.
//
// Both helpers are here so the two hosts cannot drift into two contracts, which
// is the failure this repo keeps finding in every other dual-backend seam.
import { describe, it, expect, beforeAll, vi } from 'vitest';

import {
  buildErrorBody,
  badRequest,
  forbidden,
  notFound,
  sendError,
  serverError,
  unauthorized,
} from '../../lib/error-response';
/**
 * The Deno helper is imported dynamically because _shared/http.ts pulls in
 * cors.ts, which reads Deno.env at module load. Stubbing the global first is
 * what lets the REAL edge implementation take part in this comparison instead
 * of a restatement of it, which would compare the test against itself.
 */
type ErrorResponseFn = (
  status: number,
  message: string,
  req: Request,
  opts?: { code?: string; details?: unknown; requestId?: string },
) => Response;

let errorResponse: ErrorResponseFn;

beforeAll(async () => {
  (globalThis as Record<string, unknown>).Deno = {
    env: { get: () => undefined },
  };
  ({ errorResponse } = await import('../../../supabase/functions/_shared/http'));
});

/** Minimal Express Response double: records what a handler sent. */
function fakeRes(requestId?: string) {
  const headers = new Map<string, string>();
  const state: { status?: number; body?: unknown } = {};
  const res = {
    req: requestId ? { requestId } : undefined,
    locals: {} as Record<string, unknown>,
    getHeader: (name: string) => headers.get(name),
    setHeader: (name: string, value: string) => headers.set(name, value),
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  return { res: res as never, state, headers };
}

describe('the Express helper emits the documented shape', () => {
  it('carries message, code, details and requestId', () => {
    const { res, state } = fakeRes('req-1');
    sendError(res, 422, 'Quote is below minimum margin', {
      code: 'MARGIN_TOO_LOW',
      details: { margin: 4.2, minimum: 15 },
    });

    expect(state.status).toBe(422);
    expect(state.body).toEqual({
      message: 'Quote is below minimum margin',
      code: 'MARGIN_TOO_LOW',
      details: { margin: 4.2, minimum: 15 },
      requestId: 'req-1',
    });
  });

  it('never answers with an `error` key, which is the shape being retired', () => {
    const { res, state } = fakeRes('req-1');
    serverError(res, 'boom');
    expect(Object.keys(state.body as object)).not.toContain('error');
  });

  it('reuses the request own id so body, header and log agree', () => {
    const { res, state, headers } = fakeRes('req-abc');
    notFound(res);
    expect((state.body as { requestId: string }).requestId).toBe('req-abc');
    expect(headers.get('X-Request-Id')).toBe('req-abc');
  });

  it('mints an id when the request has none, rather than omitting the field', () => {
    const { res, state } = fakeRes();
    badRequest(res, 'missing tenant');
    expect((state.body as { requestId?: string }).requestId).toMatch(/[0-9a-f-]{36}/);
  });

  it('does not overwrite an X-Request-Id already on the response', () => {
    const { res, headers } = fakeRes('req-abc');
    headers.set('X-Request-Id', 'set-earlier');
    serverError(res, 'boom');
    expect(headers.get('X-Request-Id')).toBe('set-earlier');
  });

  it('omits details entirely when there are none', () => {
    const { res, state } = fakeRes('req-1');
    unauthorized(res);
    expect('details' in (state.body as object)).toBe(false);
  });

  it('gives each shorthand its own code', () => {
    const codes = [
      [badRequest, 400, 'BAD_REQUEST'],
      [unauthorized, 401, 'UNAUTHENTICATED'],
      [forbidden, 403, 'FORBIDDEN'],
      [notFound, 404, 'NOT_FOUND'],
      [serverError, 500, 'INTERNAL_ERROR'],
    ] as const;

    for (const [fn, status, code] of codes) {
      const { res, state } = fakeRes('req-1');
      (fn as (r: never, m?: string) => unknown)(res, 'whatever');
      expect(state.status, code).toBe(status);
      expect((state.body as { code: string }).code, code).toBe(code);
    }
  });
});

describe('the two hosts produce the same body', () => {
  const cases: Array<[string, string, { code?: string; details?: unknown }]> = [
    ['plain', 'Something failed', {}],
    ['with a code', 'Not found', { code: 'NOT_FOUND' }],
    ['with details', 'Validation failed', { code: 'VALIDATION_ERROR', details: { field: 'name' } }],
    ['details but no code', 'Odd', { details: [1, 2, 3] }],
  ];

  it.each(cases)('%s', async (_name, message, opts) => {
    const requestId = 'fixed-id';

    const node = buildErrorBody(message, { ...opts, requestId });

    const deno = await errorResponse(500, message, new Request('https://example.test/x'), {
      ...opts,
      requestId,
    }).json();

    // The Deno helper always includes the keys; JSON.stringify drops undefined,
    // so comparing the PARSED bodies is the honest comparison.
    expect(node).toEqual(deno);
  });

  it('keeps the key order CLAUDE.md documents', () => {
    const body = buildErrorBody('x', { code: 'C', details: {}, requestId: 'r' });
    expect(Object.keys(body)).toEqual(['message', 'code', 'details', 'requestId']);
  });
});

describe('a request id is always present', () => {
  it('is unique per call when not supplied', () => {
    vi.restoreAllMocks();
    const a = buildErrorBody('x').requestId;
    const b = buildErrorBody('x').requestId;
    expect(a).not.toBe(b);
  });
});
