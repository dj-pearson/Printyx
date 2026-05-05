// Shared URL path helper for edge functions.
//
// Why this exists: production deploys via Dockerfile.edge-functions run
// supabase/functions/server.ts as the dispatcher. server.ts:107-109 strips
// the function name from the URL before calling the handler:
//
//   newUrl.pathname = '/' + pathParts.slice(1).join('/');
//
// So a request to /notifications/abc-123/mark-read arrives at the handler
// with pathname '/abc-123/mark-read' and pathParts = ['abc-123', 'mark-read'].
// But many handlers were originally written assuming pathParts[1] is the
// resource ID — that worked under Supabase's native runtime (which keeps the
// function name) but breaks under Coolify's server.ts.
//
// `normalizePath` makes the handler robust to either calling convention:
// it strips the function name prefix if it happens to still be there. The
// returned `parts` always has the resource ID at parts[0] and the action at
// parts[1].
//
// Usage:
//
//   const { parts } = normalizePath(new URL(req.url).pathname, 'notifications');
//   const notificationId = parts[0];   // 'abc-123'
//   const action         = parts[1];   // 'mark-read' or undefined
//
// The function-name match is anchored with `(?=\/|$)` so a function named
// "notifications" doesn't accidentally swallow a path like
// "/notifications-archive/foo".

export interface NormalizedPath {
  /** The pathname with the function-name prefix removed and trailing slashes trimmed; never empty. */
  sub: string;
  /** sub split on '/' with empty segments dropped; ready for index lookups. */
  parts: string[];
}

export function normalizePath(pathname: string, functionName: string): NormalizedPath {
  // Collapse `//` first so prefix-stripping handles malformed inputs reliably.
  const collapsed = (pathname || '/').replace(/\/+/g, '/');
  if (!functionName) {
    const sub = trimTrailing(collapsed);
    return { sub, parts: sub.split('/').filter(Boolean) };
  }
  const escaped = functionName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`^/${escaped}(?=\\/|$)`);
  const stripped = collapsed.replace(re, '');
  const sub = trimTrailing(stripped);
  return { sub, parts: sub.split('/').filter(Boolean) };
}

function trimTrailing(p: string): string {
  if (p === '/' || p === '') return '/';
  return p.replace(/\/$/, '') || '/';
}
