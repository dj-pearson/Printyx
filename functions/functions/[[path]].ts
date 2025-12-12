/**
 * Cloudflare Pages Function - Supabase Edge Functions Proxy
 * Proxies requests to self-hosted Supabase Edge Functions with proper CORS headers
 */

interface Env {
  SUPABASE_FUNCTIONS_URL: string;
  SUPABASE_ANON_KEY: string;
}

const ALLOWED_ORIGINS = [
  'https://printyx.net',
  'https://www.printyx.net',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const corsHeaders = getCorsHeaders(request);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Get the path after /functions/
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';

  // Build the Supabase functions URL
  // Edge functions are typically at {supabase_url}/functions/v1/{function_name}
  const supabaseUrl = env.SUPABASE_URL || 'https://api.printyx.net';
  const targetUrl = new URL(`/functions/${path}`, supabaseUrl);

  // Copy query parameters
  const url = new URL(request.url);
  targetUrl.search = url.search;

  // Clone headers and add Supabase-specific ones
  const headers = new Headers(request.headers);

  // Add API key if not present
  if (!headers.has('apikey') && env.SUPABASE_ANON_KEY) {
    headers.set('apikey', env.SUPABASE_ANON_KEY);
  }

  // Remove host header
  headers.delete('host');

  try {
    // Forward the request to Supabase functions
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    // Clone the response and add CORS headers
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Functions proxy error:', error);
    return new Response(
      JSON.stringify({
        error: 'Functions proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
};
