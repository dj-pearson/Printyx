/**
 * Mobile App Configuration
 *
 * Environment-specific settings for the Printyx mobile app.
 * Uses EXPO_PUBLIC_ prefixed env vars which are inlined at build time.
 *
 * API Routing:
 * - Regular /api/* calls → Express backend at printyx.net (same as website)
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
 * Build a full API URL for an Express backend endpoint.
 * Keeps the /api/ prefix intact since the Express server expects it.
 *
 * Examples:
 *   /api/business-records → https://printyx.net/api/business-records
 *   /api/service-tickets  → https://printyx.net/api/service-tickets
 */
export function getApiUrl(path: string): string {
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;

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
