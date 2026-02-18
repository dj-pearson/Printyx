/**
 * Mobile App Configuration
 *
 * Environment-specific settings for the Printyx mobile app.
 * Uses EXPO_PUBLIC_ prefixed env vars which are inlined at build time.
 *
 * Production Architecture (no Express server):
 * - printyx.net → Cloudflare Pages (static frontend)
 * - api.printyx.net → Self-hosted Supabase (Kong → PostgREST/GoTrue)
 * - functions.printyx.net → Edge Function Server (Deno)
 *
 * All data API calls go directly to functions.printyx.net,
 * matching the web app's production routing.
 */

export const config = {
  // Supabase Configuration (self-hosted instance)
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.printyx.net',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },

  // Edge Functions URL — ALL data API calls go here in production
  // This matches the web app's production config (client/src/lib/config.ts)
  edgeFunctionsUrl: process.env.EXPO_PUBLIC_EDGE_FUNCTIONS_URL || 'https://functions.printyx.net',

  // App URL for deep linking
  appUrl: process.env.EXPO_PUBLIC_APP_URL || 'https://printyx.net',

  // App metadata
  appName: 'Printyx',
  appScheme: 'printyx',
  appVersion: '1.0.0',

  // Feature flags
  isDevelopment: __DEV__,
} as const;

/**
 * Build a full API URL for a data endpoint.
 *
 * Matches the web app's production routing: /api/* calls are routed
 * to functions.printyx.net with the api/ prefix stripped.
 *
 * There is NO Express server in production — printyx.net is a static
 * Cloudflare Pages site. All backend logic runs as Supabase Edge Functions.
 *
 * Examples:
 *   /api/companies?search=abc    → https://functions.printyx.net/companies?search=abc
 *   /api/business-records/stats  → https://functions.printyx.net/business-records/stats
 *   /api/deals?limit=50          → https://functions.printyx.net/deals?limit=50
 *   /api/tasks                   → https://functions.printyx.net/tasks
 */
export function getApiUrl(path: string): string {
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Strip the api/ prefix — edge functions don't use it
  // e.g., api/companies?search=abc → companies?search=abc
  if (cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(4);
  }

  const baseUrl = config.edgeFunctionsUrl.endsWith('/')
    ? config.edgeFunctionsUrl.slice(0, -1)
    : config.edgeFunctionsUrl;

  return `${baseUrl}/${cleanPath}`;
}

/**
 * Build a URL for a Supabase Edge Function by name.
 * Used for specific edge function endpoints like signup, mobile-auth.
 *
 * Examples:
 *   getEdgeFunctionUrl('signup') → https://functions.printyx.net/signup
 *   getEdgeFunctionUrl('mobile-logs') → https://functions.printyx.net/mobile-logs
 */
export function getEdgeFunctionUrl(functionName: string): string {
  const baseUrl = config.edgeFunctionsUrl.endsWith('/')
    ? config.edgeFunctionsUrl.slice(0, -1)
    : config.edgeFunctionsUrl;

  return `${baseUrl}/${functionName}`;
}
