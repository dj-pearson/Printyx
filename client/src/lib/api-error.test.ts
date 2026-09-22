import { describe, it, expect } from 'vitest';
import { attachApiErrorDetail, describeApiError } from './api-error';

/** The exact shape queryClient.throwIfResNotOk raises. */
function thrown(status: number, body: string): Error {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  return attachApiErrorDetail(new Error(`${status}: ${body}`), {
    status,
    body: parsed,
    rawBody: body,
  });
}

describe('describeApiError', () => {
  it("uses the server's own sentence, not the JSON it arrived in", () => {
    const err = thrown(
      501,
      JSON.stringify({
        message: 'File parsing is not available on this backend. Build the steps manually.',
        notImplemented: true,
      }),
    );
    const info = describeApiError(err);
    expect(info.message).toBe(
      'File parsing is not available on this backend. Build the steps manually.',
    );
    expect(info.message).not.toContain('{');
    expect(info.message).not.toContain('501');
    expect(info.notImplemented).toBe(true);
    expect(info.status).toBe(501);
  });

  it('carries the API error format through', () => {
    const info = describeApiError(
      thrown(
        409,
        JSON.stringify({
          message: 'That customer number is already in use.',
          code: 'DUPLICATE_CUSTOMER_NUMBER',
          requestId: 'req-42',
        }),
      ),
    );
    expect(info.code).toBe('DUPLICATE_CUSTOMER_NUMBER');
    expect(info.requestId).toBe('req-42');
    expect(info.notImplemented).toBe(false);
  });

  it('reads an `error` key, which several handlers send instead of `message`', () => {
    expect(describeApiError(thrown(400, JSON.stringify({ error: 'Missing tenant' }))).message).toBe(
      'Missing tenant',
    );
  });

  it('works on the bare string shape, for an Error raised elsewhere', () => {
    // No attached detail - only the message queryClient built.
    const info = describeApiError(new Error('403: {"message":"Insufficient role"}'));
    expect(info.status).toBe(403);
    expect(info.message).toBe('Insufficient role');
  });

  it('never shows an HTML document as the message', () => {
    // An unproxied path resolves against the static origin in production,
    // where Cloudflare Pages answers the SPA shell.
    const info = describeApiError(thrown(404, '<!doctype html><html><body>Printyx</body></html>'));
    expect(info.message).not.toContain('<');
    expect(info.message).toBe('That endpoint is not available on this server.');
    expect(info.status).toBe(404);
  });

  it('shows a plain-text body as-is when it reads as a message', () => {
    expect(describeApiError(thrown(429, 'Too many requests, try again in 60s')).message).toBe(
      'Too many requests, try again in 60s',
    );
  });

  it('falls back to a sentence for an empty or statusText-only body', () => {
    expect(describeApiError(thrown(500, '')).message).toBe(
      'The server could not complete that request.',
    );
    // A JSON body with no message must not surface as `{}`.
    expect(describeApiError(thrown(500, '{}')).message).toBe(
      'The server could not complete that request.',
    );
  });

  it('a 501 is notImplemented even without the marker', () => {
    expect(describeApiError(thrown(501, '{"message":"nope"}')).notImplemented).toBe(true);
    expect(describeApiError(thrown(500, '{"message":"nope"}')).notImplemented).toBe(false);
  });

  it('only a three-digit prefix is a status', () => {
    // describeApiError is handed ANY thrown value, so a message that merely
    // starts with digits and a colon must not be mistaken for a response -
    // reporting `status: 2` invents a fact, and eats the front of the sentence.
    const info = describeApiError(new Error('2: expected at least 2 characters'));
    expect(info.status).toBeNull();
    expect(info.message).toBe('2: expected at least 2 characters');

    const longer = describeApiError(new Error('1234: batch failed'));
    expect(longer.status).toBeNull();
    expect(longer.message).toBe('1234: batch failed');
  });

  it('a network failure has no status and keeps its own message', () => {
    const info = describeApiError(new TypeError('Failed to fetch'));
    expect(info.status).toBeNull();
    expect(info.message).toBe('Failed to fetch');
    expect(info.notImplemented).toBe(false);
  });

  it('never returns an empty message, whatever it is handed', () => {
    for (const value of [null, undefined, '', new Error(''), {}, 0]) {
      expect(describeApiError(value).message.length).toBeGreaterThan(0);
    }
  });

  it('prefers the attached detail over parsing the string', () => {
    // A body containing a newline survives; the string form would too, but the
    // attached detail is what makes this reliable for any future message shape.
    const err = attachApiErrorDetail(new Error('400: unparsed'), {
      status: 400,
      body: { message: 'Line one\nLine two' },
      rawBody: '{"message":"Line one\\nLine two"}',
    });
    expect(describeApiError(err).message).toBe('Line one\nLine two');
  });

  it('the attached detail is not enumerable, so it does not leak into logs', () => {
    const err = thrown(400, '{"message":"x"}');
    expect(Object.keys(err)).not.toContain('__apiErrorDetail');
    expect(JSON.stringify(err)).toBe('{}');
  });
});
