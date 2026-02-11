// CORS helper for Edge Functions
// Allowed origins for Printyx - configurable via environment variable

// Default origins used when ALLOWED_ORIGINS env var is not set
const DEFAULT_ORIGINS = [
  'https://printyx.net',
  'https://www.printyx.net',
  'http://localhost:5173', // Vite dev server
  'http://localhost:5000', // Local development
];

// Parse ALLOWED_ORIGINS from environment variable (comma-separated)
// Falls back to defaults if not set
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

const ALLOWED_ORIGINS = getAllowedOrigins();

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-tenant-id, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// Legacy export for backward compatibility
export const corsHeaders = getCorsHeaders(null);

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  return null;
}

export function createCorsResponse(
  body: any,
  status: number,
  req: Request,
  deprecationWarning?: string,
): Response {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json',
  };

  if (deprecationWarning) {
    headers['X-Deprecation-Warning'] = deprecationWarning;
    headers['X-Deprecated'] = 'true';
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
