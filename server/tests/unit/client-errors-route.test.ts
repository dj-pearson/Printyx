/**
 * Tests for the client error reporting endpoint (US-024)
 * POST /api/client-errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Express, Request, Response } from 'express';

const logError = vi.hoisted(() => vi.fn());
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    error: logError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { registerClientErrorRoutes } from '../../routes-client-errors';

type Handler = (req: Request, res: Response) => unknown;

function captureHandler(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: (_path: string, fn: Handler) => {
      handler = fn;
    },
  } as unknown as Express;
  registerClientErrorRoutes(app);
  if (!handler) throw new Error('handler not registered');
  return handler;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

function mockReq(body: unknown): Request {
  return { body, ip: '127.0.0.1', headers: {} } as unknown as Request;
}

describe('POST /api/client-errors', () => {
  beforeEach(() => {
    logError.mockClear();
  });

  it('registers the route at /api/client-errors', () => {
    const paths: string[] = [];
    const app = {
      post: (path: string) => {
        paths.push(path);
      },
    } as unknown as Express;
    registerClientErrorRoutes(app);
    expect(paths).toEqual(['/api/client-errors']);
  });

  it('accepts a valid error report and returns 204', () => {
    const handler = captureHandler();
    const res = mockRes();
    handler(
      mockReq({
        message: 'TypeError: x is undefined',
        stack: 'TypeError: x is undefined\n  at Foo',
        componentStack: '\n  at Widget',
        boundary: 'page:/customers',
        url: 'https://app.printyx.net/customers',
        userAgent: 'vitest',
        timestamp: '2026-06-12T00:00:00.000Z',
      }),
      res,
    );
    expect(res.statusCode).toBe(204);
    expect(logError).toHaveBeenCalledTimes(1);
    const [context, message] = logError.mock.calls[0];
    expect(message).toContain('page:/customers');
    expect(message).toContain('TypeError: x is undefined');
    expect(context.clientError.message).toBe('TypeError: x is undefined');
  });

  it('accepts a minimal report with only a message', () => {
    const handler = captureHandler();
    const res = mockRes();
    handler(mockReq({ message: 'boom' }), res);
    expect(res.statusCode).toBe(204);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('rejects a report without a message', () => {
    const handler = captureHandler();
    const res = mockRes();
    handler(mockReq({ stack: 'no message here' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(logError).not.toHaveBeenCalled();
  });

  it('rejects an oversized message (length cap)', () => {
    const handler = captureHandler();
    const res = mockRes();
    handler(mockReq({ message: 'x'.repeat(2001) }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-object bodies', () => {
    const handler = captureHandler();
    const res = mockRes();
    handler(mockReq('not-json'), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
