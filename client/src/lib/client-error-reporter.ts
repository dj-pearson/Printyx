/**
 * Client Error Reporter
 *
 * Sends React rendering errors caught by error boundaries to the server
 * (POST /api/client-errors) so they appear in server-side structured logs.
 *
 * Safety properties:
 * - Never throws (a failing reporter must not crash an already-broken UI)
 * - Dedupes identical errors per session
 * - Caps total reports per session to avoid flooding the endpoint
 *
 * NOTE: uses a same-origin relative fetch on purpose. getApiUrl() rewrites
 * /api/* to the Edge Functions host in production, but this endpoint lives
 * on the Express server that serves the SPA.
 */

export interface ClientErrorContext {
  /** React component stack from componentDidCatch */
  componentStack?: string;
  /** Which boundary caught the error (e.g. "page:/customers", "section:Revenue") */
  boundary?: string;
}

const MAX_REPORTS_PER_SESSION = 10;
const reportedKeys = new Set<string>();
let reportCount = 0;

export function reportClientError(error: unknown, context: ClientErrorContext = {}): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${context.boundary ?? ''}|${err.message}`;

    if (reportedKeys.has(key) || reportCount >= MAX_REPORTS_PER_SESSION) {
      return;
    }
    reportedKeys.add(key);
    reportCount++;

    const payload = {
      message: err.message || 'Unknown error',
      stack: err.stack?.slice(0, 10000),
      componentStack: context.componentStack?.slice(0, 10000),
      boundary: context.boundary?.slice(0, 200),
      url: typeof window !== 'undefined' ? window.location.href.slice(0, 2000) : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : undefined,
      timestamp: new Date().toISOString(),
    };

    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      // Swallow network errors - reporting is best-effort
    });
  } catch {
    // The reporter must never throw
  }
}

/** Test-only helper to reset session dedupe state */
export function __resetClientErrorReporter(): void {
  reportedKeys.clear();
  reportCount = 0;
}
