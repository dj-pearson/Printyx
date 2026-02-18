/**
 * Mobile App Configuration
 *
 * Environment-specific settings for the Printyx mobile app.
 * Uses EXPO_PUBLIC_ prefixed env vars which are inlined at build time.
 *
 * API Routing:
 * - CRM/data endpoints → Edge Functions at functions.printyx.net (companies, deals, etc.)
 * - Other /api/* calls → Express backend at printyx.net (auth, settings, etc.)
 * - Edge Function calls (signup, etc.) → functions.printyx.net via Supabase URL
 */

export const config = {
  // Supabase Configuration (same instance as web)
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.printyx.net',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },

  // API Base URL - Express backend server (same as website)
  // All /api/* routes go here, matching the web app's routing
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://printyx.net',

  // Edge Functions URL - for Supabase Edge Functions only (signup, etc.)
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
 * API paths that should be routed directly to Edge Functions
 * instead of the Express backend. These endpoints have been migrated
 * to Supabase Edge Functions with correct table references.
 */
const EDGE_FUNCTION_PATHS = [
  'api/companies',
  'api/business-records',
  'api/deals',
  'api/contacts',
  'api/opportunities',
  'api/quotes',
  'api/proposals',
];

/**
 * Build a full API URL for a backend endpoint.
 *
 * Routes known edge function paths to functions.printyx.net directly,
 * and all other /api/* paths to the Express backend at printyx.net.
 *
 * Examples:
 *   /api/companies?search=abc    → https://functions.printyx.net/companies?search=abc
 *   /api/business-records/stats  → https://functions.printyx.net/business-records/stats
 *   /api/service-tickets         → https://printyx.net/api/service-tickets
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Extract the base path (before query string) for matching
  const basePath = cleanPath.split('?')[0].replace(/\/$/, ''); // strip trailing slash

  // Check if this path should go to edge functions
  for (const efPath of EDGE_FUNCTION_PATHS) {
    if (basePath === efPath || basePath.startsWith(efPath + '/')) {
      // Route to edge function: api/companies/123?x=1 → functions.printyx.net/companies/123?x=1
      const functionPath = cleanPath.replace(/^api\//, '');
      const edgeBaseUrl = config.edgeFunctionsUrl.endsWith('/')
        ? config.edgeFunctionsUrl.slice(0, -1)
        : config.edgeFunctionsUrl;
      return `${edgeBaseUrl}/${functionPath}`;
    }
  }

  // Default: route to Express backend
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

/**
 * Check if a URL points to an edge function endpoint.
 * Used by apiRequest to add the apikey header for edge function calls.
 */
export function isEdgeFunctionUrl(url: string): boolean {
  const edgeBase = config.edgeFunctionsUrl.endsWith('/')
    ? config.edgeFunctionsUrl.slice(0, -1)
    : config.edgeFunctionsUrl;
  return url.startsWith(edgeBase);
}
