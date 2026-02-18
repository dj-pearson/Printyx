/**
 * Mobile App Configuration
 *
 * Environment-specific settings for the Printyx mobile app.
 * Uses EXPO_PUBLIC_ prefixed env vars which are inlined at build time.
 *
 * API Routing:
 * - ALL /api/* calls → Express backend at printyx.net
 *   Express has a proxy middleware that forwards CRM endpoints
 *   (companies, deals, contacts, etc.) to Supabase Edge Functions
 *   server-side. This avoids mobile-to-edge-function direct connection
 *   issues (Cloudflare bot protection, CORS, network policies).
 * - Edge Function calls (signup, etc.) → functions.printyx.net directly
 */

export const config = {
  // Supabase Configuration (same instance as web)
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.printyx.net',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },

  // API Base URL - Express backend server (same as website)
  // ALL /api/* routes go here. Express proxy forwards CRM calls to edge functions.
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://printyx.net',

  // Edge Functions URL - for direct edge function calls only (signup, mobile-auth, etc.)
  // NOT used for CRM data - those go through Express proxy
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
 * Build a full API URL for a backend endpoint.
 *
 * ALL /api/* calls go to the Express backend at printyx.net.
 * Express has a proxy middleware that forwards CRM endpoints
 * (companies, deals, contacts, business-records, opportunities,
 * quotes, proposals) to Supabase Edge Functions server-side.
 *
 * Examples:
 *   /api/companies?search=abc    → https://printyx.net/api/companies?search=abc
 *   /api/business-records/stats  → https://printyx.net/api/business-records/stats
 *   /api/service-tickets         → https://printyx.net/api/service-tickets
 *   /api/tasks                   → https://printyx.net/api/tasks
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  const baseUrl = config.apiBaseUrl.endsWith('/')
    ? config.apiBaseUrl.slice(0, -1)
    : config.apiBaseUrl;

  return `${baseUrl}/${cleanPath}`;
}

/**
 * Build a URL for a Supabase Edge Function.
 * Used for specific edge function endpoints like signup.
 *
 * Examples:
 *   getEdgeFunctionUrl('signup') → https://functions.printyx.net/signup
 */
export function getEdgeFunctionUrl(functionName: string): string {
  const baseUrl = config.edgeFunctionsUrl.endsWith('/')
    ? config.edgeFunctionsUrl.slice(0, -1)
    : config.edgeFunctionsUrl;

  return `${baseUrl}/${functionName}`;
}

