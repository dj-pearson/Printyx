// Edge Functions Router with CORS support
// This is the main entry point for all Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders } from '/app/functions/_shared/cors.ts';

const port = parseInt(Deno.env.get('PORT') || '3001');

// PostgreSQL timestamps have microsecond precision and colon timezone offsets
// (e.g. "2024-01-15T10:30:00.123456+00:00") which many iOS date decoders can't parse.
// This regex matches ISO8601 timestamps with fractional seconds and timezone offsets.
const PG_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// Recursively normalize date strings in JSON to JavaScript's toISOString() format
// which always produces "YYYY-MM-DDTHH:mm:ss.sssZ" (3ms digits, Z timezone).
function normalizeDates(value: unknown): unknown {
  if (typeof value === 'string' && PG_TIMESTAMP_RE.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeDates(v);
    }
    return out;
  }
  return value;
}

// Load all function handlers
const functions: Record<string, any> = {};

// Dynamically load functions
for await (const dirEntry of Deno.readDir('/app/functions')) {
  if (dirEntry.isDirectory && !dirEntry.name.startsWith('_')) {
    try {
      const handler = await import(`/app/functions/${dirEntry.name}/index.ts`);
      functions[dirEntry.name] = handler;
      console.log(`✅ Loaded function: ${dirEntry.name}`);
    } catch (e) {
      console.error(`❌ Failed to load ${dirEntry.name}:`, e.message);
    }
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

    // Route to function
    const functionName = pathParts[0];

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
      newUrl.pathname = '/' + pathParts.slice(1).join('/');
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

      // Normalize date strings in JSON responses so iOS decoders can parse them.
      // PostgreSQL returns "2024-01-15T10:30:00.123456+00:00" (6-digit microseconds,
      // colon timezone) which many mobile date parsers can't handle.
      // toISOString() produces "2024-01-15T10:30:00.123Z" (3ms digits, Z timezone).
      const contentType = newHeaders.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const body = await response.json();
          const normalized = normalizeDates(body);
          newHeaders.set('content-type', 'application/json; charset=utf-8');
          return new Response(JSON.stringify(normalized), {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        } catch {
          // If JSON parsing fails, pass through the original response
        }
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
