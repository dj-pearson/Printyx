/**
 * What to tell a person when an API call failed.
 *
 * THE PROBLEM THIS SOLVES. `apiRequest`/`apiFormRequest` throw a plain Error
 * built as `new Error(\`${res.status}: ${body}\`)`, and 71 files toast
 * `err.message` straight into a description. This product's documented error
 * format is `{ message, code, details, requestId }`, so what a user actually
 * reads is:
 *
 *   501: {"message":"File parsing is not available on this backend. Build the
 *   workflow steps manually.","notImplemented":true}
 *
 * - the server's sentence, wrapped in the JSON it arrived in. The reason is
 * there and nobody can read it. CLAUDE.md already records the other half of
 * this trap (CRM-008): `error.response?.data?.message` is ALWAYS undefined
 * here, because the thrown value is a plain Error and not an axios error, so
 * pages that tried to reach the server's reason got the generic fallback.
 *
 * WHY THE STRING IS STILL PARSED. `queryClient.ts` (and callers elsewhere)
 * branch on `message.includes('403')` and `message.startsWith('404')` to decide
 * retries and returnNull behaviour, so the `NNN: ` prefix is load-bearing and
 * cannot be removed from `Error.message`. Instead the thrown Error now CARRIES
 * the parsed fields (see `attachApiErrorDetail`), and this reader prefers them,
 * falling back to parsing the string for an Error raised anywhere else.
 *
 * AN UNPARSEABLE BODY IS NOT SHOWN. A path that is not proxied resolves against
 * the static origin in production, where Cloudflare Pages answers the SPA
 * shell - so the "message" would be a whole HTML document. A body that is not
 * JSON and looks like markup is replaced by a sentence derived from the status,
 * because a 300-character slice of `<!doctype html>` in a toast tells a user
 * nothing and hides the fact that the request reached the wrong host.
 */

export interface ApiErrorInfo {
  /** HTTP status, or null when the request never produced a response. */
  status: number | null;
  /** The sentence to show. Never empty. */
  message: string;
  /** The API's error code, when the server sent one. */
  code: string | null;
  /** The server's request id, for a support conversation. */
  requestId: string | null;
  /**
   * The backend does not implement this. True on 501, or on an explicit
   * `notImplemented` marker. Worth distinguishing because it is not a fault:
   * telling someone "not available here" beats telling them it failed.
   */
  notImplemented: boolean;
}

/** Fields we hang off a thrown Error so the reader never has to parse a string. */
export interface ApiErrorDetail {
  status: number;
  body: unknown;
  rawBody: string;
}

const DETAIL = '__apiErrorDetail';

/** Attach the parsed response to an Error without changing its `message`. */
export function attachApiErrorDetail(err: Error, detail: ApiErrorDetail): Error {
  Object.defineProperty(err, DETAIL, {
    value: detail,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return err;
}

function readDetail(err: unknown): ApiErrorDetail | null {
  if (!err || typeof err !== 'object') return null;
  const d = (err as Record<string, unknown>)[DETAIL];
  if (!d || typeof d !== 'object') return null;
  const detail = d as Partial<ApiErrorDetail>;
  return typeof detail.status === 'number' && typeof detail.rawBody === 'string'
    ? { status: detail.status, body: detail.body, rawBody: detail.rawBody }
    : null;
}

/** A response body that is a document, not a message. */
function looksLikeMarkup(text: string): boolean {
  return /^\s*(?:<!doctype|<html|<\?xml|<head|<body)/i.test(text);
}

function statusSentence(status: number): string {
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'That endpoint is not available on this server.';
  if (status === 501) return 'This backend does not support that yet.';
  if (status >= 500) return 'The server could not complete that request.';
  return 'That request was rejected.';
}

function fromBody(status: number, body: unknown, rawBody: string): ApiErrorInfo {
  const obj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const serverMessage = typeof obj?.message === 'string' ? obj.message.trim() : '';
  const serverError = typeof obj?.error === 'string' ? obj.error.trim() : '';
  const plain = rawBody.trim();

  let message = serverMessage || serverError;
  if (!message) {
    // No structured message. Use the raw text only when it reads as a message.
    message = obj || looksLikeMarkup(plain) || plain === '' ? '' : plain;
  }
  if (!message) message = statusSentence(status);

  return {
    status,
    message,
    code: typeof obj?.code === 'string' ? obj.code : null,
    requestId: typeof obj?.requestId === 'string' ? obj.requestId : null,
    notImplemented: status === 501 || obj?.notImplemented === true,
  };
}

/**
 * Read a thrown API failure into something a person can act on.
 *
 * Works on an Error carrying `attachApiErrorDetail`, on the bare
 * `"<status>: <body>"` shape, and on any other thrown value - a network
 * failure has no status and keeps its own message.
 */
export function describeApiError(err: unknown): ApiErrorInfo {
  const detail = readDetail(err);
  if (detail) return fromBody(detail.status, detail.body, detail.rawBody);

  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const m = /^(\d{3}): ([\s\S]*)$/.exec(raw);
  if (!m) {
    return {
      status: null,
      message: raw.trim() || 'Something went wrong. Try again.',
      code: null,
      requestId: null,
      notImplemented: false,
    };
  }

  const status = Number(m[1]);
  const text = m[2];
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return fromBody(status, parsed, text);
}
