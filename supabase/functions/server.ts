// Edge Functions Router with CORS support
// This is the main entry point for all Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const port = parseInt(Deno.env.get('PORT') || '3001');

// CORS Configuration
const ALLOWED_ORIGINS = [
  'https://printyx.net',
  'https://www.printyx.net',
  'http://localhost:5173',
  'http://localhost:5000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-tenant-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
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
