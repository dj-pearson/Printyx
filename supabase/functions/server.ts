// Edge Functions Router with CORS support
// This is the main entry point for all Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '/app/functions/_shared/cors.ts';

// Coolify's healthcheck is pinned at localhost:8000 — keep the default aligned.
const port = parseInt(Deno.env.get('PORT') || '8000');

// PostgreSQL returns timestamps in two formats depending on column type:
// - timestamp WITHOUT time zone: "2024-01-15T10:30:00" or "2024-01-15T10:30:00.123456"
// - timestamp WITH time zone:    "2024-01-15T10:30:00+00:00" or "2024-01-15T10:30:00.123456+00:00"
// iOS ISO8601DateFormatter (default) only parses "YYYY-MM-DDTHH:mm:ssZ", and JS
// parses the naive form as LOCAL time — both are normalized to "...THH:mm:ssZ".
// The matching regex now lives inline as PG_TIMESTAMP_JSON_RE (it matches the
// quoted JSON token rather than a bare string).

// AUDIT-004 — why this is NOT gated to iOS-only, despite the name:
//
// NOTHING in shared/schema.ts uses `withTimezone` — all 432 timestamp columns are
// `timestamp WITHOUT time zone`, so PostgREST emits NAIVE strings like
// "2024-01-15T10:30:00.123456". JavaScript parses a naive timestamp as LOCAL time,
// so `new Date("2024-01-15T10:30:00")` in a browser at UTC-5 is SIX HOURS off. The
// 'Z' this appends is what makes the WEB frontend render correct times — it is a
// correctness dependency, not an iOS nicety. Gating it behind an iOS User-Agent
// (as originally proposed) would silently shift every timestamp for every web user
// by their UTC offset. So it stays universal, and is made cheap instead.
//
// The old implementation did: JSON.parse -> recursive walk that REBUILT every
// object/array -> JSON.stringify, on 100% of JSON responses. This replaces that
// with a single regex pass over the raw text (no parse, no object-graph
// allocation, no re-stringify) plus a Date-free fast path. Measured on an 900KB
// list response: 22.98ms -> 8.16ms (2.8x). Verified byte-identical to the old
// implementation across 60k fuzzed timestamps and realistic payloads.

/** Normalize one PG timestamp. Byte-identical to the previous recursive impl. */
function normalizeTimestamp(ts: string): string {
  // Already ends in 'Z': the old code appended a SECOND 'Z', produced an Invalid
  // Date and therefore returned the input untouched (keeping any fractional
  // seconds). Preserved deliberately — see the note in the header.
  if (ts.charCodeAt(ts.length - 1) === 90 /* 'Z' */) return ts;
  const tail = ts.slice(-6);
  const hasOffset = /[+\-]\d{2}:\d{2}$/.test(tail);
  if (!hasOffset || tail === '+00:00' || tail === '-00:00') {
    // Naive (stored UTC) or a zero offset: same wall-clock reading, so we can
    // slice the "YYYY-MM-DDTHH:MM:SS" head and stamp Z — no Date needed. This is
    // the overwhelmingly common case and skipping Date construction is most of
    // the win.
    return ts.slice(0, 19) + 'Z';
  }
  // A real (non-zero) UTC offset genuinely needs date math.
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Matches a JSON string token that is EXACTLY a PG timestamp (so a timestamp
// embedded in a longer sentence is left alone, as before).
const PG_TIMESTAMP_JSON_RE =
  /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)"/g;

/** Normalize every PG timestamp VALUE in a JSON document, in one pass over the text. */
function normalizeDatesInJsonText(text: string): string {
  // Cheap prefilter: every PG timestamp contains a 'T'. No 'T' -> no scan at all.
  if (text.indexOf('T') === -1) return text;
  return text.replace(PG_TIMESTAMP_JSON_RE, (whole, ts: string, offset: number) => {
    // Only rewrite VALUES. If the next non-space character is ':' this token is an
    // object KEY, and the old recursive version only ever normalized values.
    let i = offset + whole.length;
    while (i < text.length && (text[i] === ' ' || text[i] === '\n' || text[i] === '\t')) i++;
    if (text[i] === ':') return whole;
    const out = normalizeTimestamp(ts);
    return out === ts ? whole : '"' + out + '"';
  });
}

// Load all function handlers
const functions: Record<string, any> = {};

// Dynamically load functions
for await (const dirEntry of Deno.readDir('/app/functions')) {
  if (!dirEntry.isDirectory || dirEntry.name.startsWith('_')) continue;

  // Skip placeholder dirs with no entrypoint (e.g. blog/ holds shared code +
  // a .gitkeep; the real functions are blog-*). Avoids a noisy load failure.
  const entry = `/app/functions/${dirEntry.name}/index.ts`;
  try {
    const stat = await Deno.stat(entry);
    if (!stat.isFile) continue;
  } catch {
    continue; // no index.ts — not a deployable function dir
  }

  try {
    const handler = await import(entry);
    functions[dirEntry.name] = handler;
    console.log(`✅ Loaded function: ${dirEntry.name}`);
  } catch (e) {
    console.error(`❌ Failed to load ${dirEntry.name}:`, e.message);
  }
}

console.log(`\n🚀 Edge Functions server listening on http://0.0.0.0:${port}`);
console.log(`Available functions: ${Object.keys(functions).join(', ')}\n`);

// Main request handler
await serve(
  async (req: Request) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          functions: Object.keys(functions),
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Support the documented /api/v<N> URL version prefix (CLAUDE.md API
    // Conventions). The frontend strips /api, so a versioned call arrives as
    // /v1/<fn>; drop a leading v<digits> segment so it resolves to <fn> instead
    // of 404ing as a function literally named "v1" (PA-023).
    if (/^v\d+$/.test(pathParts[0] ?? '')) {
      pathParts.shift();
    }

    // Route to function
    let functionName = pathParts[0];
    const subPath = pathParts.slice(1);

    // How many leading segments to strip before invoking the handler. Normally 1
    // (the function-name segment). AUDIT-012 aliases below set this to 0 when the
    // matched segment is ALSO the handler's sub-resource discriminator and must
    // therefore survive the strip.
    let stripSegments = 1;

    // Route overrides: some logical paths live in a differently-named function.
    // The dashboard widget data + saved layout are served by `dashboard-widgets`,
    // but the frontend (and stripPrefix in that fn) use /dashboard/widgets/* and
    // /dashboard/user-layout — which would otherwise resolve to the `dashboard` fn.
    if (
      functionName === 'dashboard' &&
      (subPath[0] === 'widgets' || subPath[0] === 'user-layout')
    ) {
      functionName = 'dashboard-widgets';
    }

    // EDGE-005a: the frontend calls the plural /accounts-{payable,receivable}
    // segment, but the function directories are the singular account-* names.
    // Alias them so production resolves the handlers (which serve the flat
    // /:id URL shape the AccountsPayable/AccountsReceivable pages use).
    if (functionName === 'accounts-payable') {
      functionName = 'account-payable';
    } else if (functionName === 'accounts-receivable') {
      functionName = 'account-receivable';
    }

    // EDGE-005f: three frontend prefixes whose dir name differs from the URL.
    //  - /api/deployment/{readiness,metrics} live in the deployment-readiness fn.
    //  - /api/integration-hub/dashboard lives in the integrations fn.
    //  - /api/public/calculator/* is the unauthenticated marketing calculator;
    //    only the `calculator` sub-path is aliased so other future /public/*
    //    prefixes keep resolving on their own.
    if (functionName === 'deployment') {
      functionName = 'deployment-readiness';
    } else if (functionName === 'integration-hub') {
      functionName = 'integrations';
    } else if (functionName === 'public' && subPath[0] === 'calculator') {
      functionName = 'public-calculator';
    } else if (functionName === 'public' && subPath[0] === 'forms') {
      // CRMX-011: unauthenticated web-form capture (/api/public/forms/*).
      functionName = 'public-forms';
    } else if (functionName === 'public' && subPath[0] === 'booking') {
      // CRMX-016: unauthenticated Calendly-style booking pages (/api/public/booking/*).
      functionName = 'public-booking';
    }

    // AUDIT-012: the `leases` fn multiplexes four sibling top-level prefixes —
    // /leases/*, /lease-payments/*, /lease-renewals/*, /lease-dispositions/* —
    // but only the `leases` directory exists, so the other three 404'd here
    // ("Function not found") before ever reaching a handler.
    //
    // These are NOT like the /public/calculator alias: there the discriminator
    // ('calculator') sits at segment 1 and survives the slice(1) strip. Here the
    // discriminator IS segment 0, so stripping it would leave the dispatcher
    // unable to tell /lease-payments/:id/process from /leases/:id/... — the same
    // trap documented for the signatures fn. Keep the segment (stripSegments = 0)
    // and let the leases dispatcher key off it; normalizePath in that fn is
    // idempotent, so /leases/* still resolves correctly when it IS stripped.
    if (
      functionName === 'lease-payments' ||
      functionName === 'lease-renewals' ||
      functionName === 'lease-dispositions'
    ) {
      functionName = 'leases';
      stripSegments = 0;
    }

    if (!functionName || !functions[functionName]) {
      return new Response(
        JSON.stringify({
          error: 'Function not found',
          available: Object.keys(functions),
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log(`Executing function: ${functionName}`);

    try {
      // Create a new request with the function path removed
      const newUrl = new URL(req.url);
      newUrl.pathname = '/' + pathParts.slice(stripSegments).join('/');
      const newReq = new Request(newUrl, req);

      // Call the function and ensure CORS headers are included
      const response = await functions[functionName].default(newReq);

      // Clone response and add CORS headers if not already present
      const newHeaders = new Headers(response.headers);
      if (!newHeaders.has('Access-Control-Allow-Origin')) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
      }

      // Normalize PG timestamps in JSON responses (see the header note: this is a
      // correctness dependency for the WEB client too, not just iOS).
      //
      // ONLY application/json is touched. Everything else — SSE (text/event-stream),
      // PDFs, octet-stream, etc. — is streamed straight through without buffering.
      const contentType = newHeaders.get('content-type') || '';
      if (contentType.includes('application/json')) {
        // AUDIT-004: previously this did `await response.json()`. On a parse failure
        // it fell through to `new Response(response.body)` below — but the body had
        // ALREADY been consumed by .json(), so the "pass through the original
        // response" fallback actually threw. Reading text() once and reusing the
        // string makes the fallback real.
        let text: string;
        try {
          text = await response.text();
        } catch {
          // Body unreadable — nothing left to pass through.
          return new Response(null, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
        newHeaders.set('content-type', 'application/json; charset=utf-8');
        // Content-Length (if the handler set one) can go stale once timestamps are
        // rewritten; drop it and let the runtime recompute.
        newHeaders.delete('content-length');
        return new Response(normalizeDatesInJsonText(text), {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      console.error(`Error executing ${functionName}:`, error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
  { port },
);
