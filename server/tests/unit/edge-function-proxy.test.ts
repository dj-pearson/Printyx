/**
 * Unit Tests: Edge Function Proxy Body Handling (EDGE-002l)
 *
 * Verifies that the proxy:
 *  1. Forwards JSON requests by re-serializing req.body
 *  2. Forwards multipart bodies as raw bytes with original Content-Type
 *  3. Returns text responses via res.send
 *  4. Returns binary responses via res.end(Buffer) byte-equal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';

// Mock the logger before importing the proxy module
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { __test } from '../../middleware/edge-function-proxy';

const { isTextContentType, buildProxyHeaders, readRawBody, forwardToEdgeFunction } = __test;

// ─── isTextContentType ─────────────────────────────────────────────────

describe('isTextContentType', () => {
  it.each([
    ['application/json', true],
    ['application/json; charset=utf-8', true],
    ['text/plain', true],
    ['text/html; charset=utf-8', true],
    ['application/xml', true],
    ['application/javascript', true],
    ['text/csv', true],
    ['application/x-www-form-urlencoded', true],
    ['application/pdf', false],
    ['application/zip', false],
    ['application/octet-stream', false],
    ['image/png', false],
    ['image/jpeg', false],
    ['video/mp4', false],
  ])('%s → %s', (ct, expected) => {
    expect(isTextContentType(ct)).toBe(expected);
  });

  it('null → true (assume text)', () => {
    expect(isTextContentType(null)).toBe(true);
  });

  it('undefined → true (assume text)', () => {
    expect(isTextContentType(undefined)).toBe(true);
  });

  it('empty string → true', () => {
    expect(isTextContentType('')).toBe(true);
  });
});

// ─── buildProxyHeaders ─────────────────────────────────────────────────

describe('buildProxyHeaders', () => {
  function makeReq(headers: Record<string, string> = {}, extras: any = {}) {
    return { headers, ...extras } as any;
  }

  it('json mode sets Content-Type: application/json', () => {
    const headers = buildProxyHeaders(makeReq(), 'json');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('passthrough mode forwards incoming Content-Type', () => {
    const ct = 'multipart/form-data; boundary=----WebKitFormBoundary123';
    const headers = buildProxyHeaders(makeReq({ 'content-type': ct }), 'passthrough');
    expect(headers.get('Content-Type')).toBe(ct);
  });

  it('none mode omits Content-Type', () => {
    const headers = buildProxyHeaders(makeReq({ 'content-type': 'application/json' }), 'none');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('forwards Authorization header', () => {
    const headers = buildProxyHeaders(makeReq({ authorization: 'Bearer abc.def.xyz' }), 'json');
    expect(headers.get('Authorization')).toBe('Bearer abc.def.xyz');
  });

  it('forwards x-tenant-id from header', () => {
    const headers = buildProxyHeaders(makeReq({ 'x-tenant-id': 'tenant-1' }), 'json');
    expect(headers.get('x-tenant-id')).toBe('tenant-1');
  });

  it('forwards x-tenant-id from req.user.tenantId fallback', () => {
    const headers = buildProxyHeaders(makeReq({}, { user: { tenantId: 'tenant-2' } }), 'json');
    expect(headers.get('x-tenant-id')).toBe('tenant-2');
  });

  it('forwards x-tenant-id from req.supabaseUser.tenantId fallback', () => {
    const headers = buildProxyHeaders(
      makeReq({}, { supabaseUser: { tenantId: 'tenant-3' } }),
      'json',
    );
    expect(headers.get('x-tenant-id')).toBe('tenant-3');
  });
});

// ─── readRawBody ───────────────────────────────────────────────────────

describe('readRawBody', () => {
  it('reads a single-chunk Buffer', async () => {
    const data = Buffer.from('hello world');
    const stream = Readable.from([data]);
    const out = await readRawBody(stream as any);
    expect(out.equals(data)).toBe(true);
  });

  it('reads and concatenates multiple chunks preserving binary bytes', async () => {
    const a = Buffer.from([0x00, 0x01, 0xff]);
    const b = Buffer.from([0xfe, 0x10, 0x20]);
    const stream = Readable.from([a, b]);
    const out = await readRawBody(stream as any);
    expect(out.equals(Buffer.concat([a, b]))).toBe(true);
  });

  it('handles empty stream', async () => {
    const stream = Readable.from([]);
    const out = await readRawBody(stream as any);
    expect(out.length).toBe(0);
  });
});

// ─── forwardToEdgeFunction ─────────────────────────────────────────────

describe('forwardToEdgeFunction (integration)', () => {
  let originalFetch: typeof fetch;
  let res: any;
  let next: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    res = {
      _status: 200,
      _sent: undefined as any,
      _ended: undefined as any,
      _headers: {} as Record<string, string>,
      headersSent: false,
      status: vi.fn(function (this: any, code: number) {
        this._status = code;
        return this;
      }),
      send: vi.fn(function (this: any, data: any) {
        this._sent = data;
        return this;
      }),
      end: vi.fn(function (this: any, data?: any) {
        this._ended = data;
        return this;
      }),
      setHeader: vi.fn(function (this: any, key: string, value: string) {
        this._headers[key] = value;
        return this;
      }),
    };
    next = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeReq(
    opts: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      stream?: Readable;
    } = {},
  ) {
    const base = opts.stream ?? Readable.from([]);
    const req: any = base;
    req.method = opts.method ?? 'GET';
    req.headers = opts.headers ?? {};
    req.body = opts.body;
    req.originalUrl = '/api/test';
    return req;
  }

  it('GET request: sends no body, returns JSON text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as any;

    await forwardToEdgeFunction(
      makeReq({ method: 'GET' }),
      res,
      next,
      'https://functions.example/test',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://functions.example/test',
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });

  it('POST JSON: re-serializes req.body and sets Content-Type: application/json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as any;

    const req = makeReq({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { name: 'Alice' },
    });
    await forwardToEdgeFunction(req, res, next, 'https://functions.example/users');

    const call = fetchMock.mock.calls[0][1];
    expect(call.method).toBe('POST');
    expect(call.body).toBe(JSON.stringify({ name: 'Alice' }));
    expect((call.headers as Headers).get('Content-Type')).toBe('application/json');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('POST multipart: forwards raw stream bytes and preserves Content-Type with boundary', async () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const multipartBody = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        `name,age\r\nAlice,30\r\n` +
        `--${boundary}--\r\n`,
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ uploaded: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as any;

    const req = makeReq({
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      stream: Readable.from([multipartBody]),
    });
    await forwardToEdgeFunction(req, res, next, 'https://functions.example/import');

    const call = fetchMock.mock.calls[0][1];
    expect(call.method).toBe('POST');
    // Body should be the raw buffer, byte-equal
    expect(Buffer.isBuffer(call.body)).toBe(true);
    expect((call.body as Buffer).equals(multipartBody)).toBe(true);
    // Content-Type with boundary preserved
    expect((call.headers as Headers).get('Content-Type')).toBe(
      `multipart/form-data; boundary=${boundary}`,
    );
  });

  it('binary response: returns byte-equal buffer via res.end', async () => {
    // Fake PDF magic bytes + payload
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0xff, 0x00]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pdfBytes, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="invoice-123.pdf"',
        },
      }),
    );
    globalThis.fetch = fetchMock as any;

    await forwardToEdgeFunction(
      makeReq({ method: 'GET' }),
      res,
      next,
      'https://functions.example/billing/invoices/123/pdf',
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="invoice-123.pdf"',
    );
    expect(res.end).toHaveBeenCalled();
    const sentBuf: Buffer = (res.end as any).mock.calls[0][0];
    expect(Buffer.isBuffer(sentBuf)).toBe(true);
    expect(sentBuf.equals(pdfBytes)).toBe(true);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('network error: calls next() (fallthrough to Express)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    await forwardToEdgeFunction(
      makeReq({ method: 'GET' }),
      res,
      next,
      'https://functions.example/dead',
    );

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('non-write methods skip body building even with body set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    globalThis.fetch = fetchMock as any;

    await forwardToEdgeFunction(
      makeReq({ method: 'DELETE', body: { ignored: true } }),
      res,
      next,
      'https://functions.example/items/1',
    );

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});
