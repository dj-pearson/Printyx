/**
 * Mobile App Configuration
 *
 * Environment-specific settings for the Printyx mobile app.
 * Uses EXPO_PUBLIC_ prefixed env vars which are inlined at build time.
 */

export const config = {
  // Supabase Configuration (same instance as web)
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://api.printyx.net',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },

  // API Base URL - Edge Functions in production
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://functions.printyx.net',

  // App URL for deep linking
  appUrl: process.env.EXPO_PUBLIC_APP_URL || 'https://app.printyx.net',

  // App metadata
  appName: 'Printyx',
  appScheme: 'printyx',
  appVersion: '1.0.0',

  // Feature flags
  isDevelopment: __DEV__,
} as const;

/**
 * Build a full API URL for an endpoint.
 * Strips /api/ prefix for Edge Function routing (same as web).
 */
export function getApiUrl(path: string): string {
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Strip /api/ prefix for Edge Functions
  if (cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(4);
  }

  const baseUrl = config.apiBaseUrl.endsWith('/')
    ? config.apiBaseUrl.slice(0, -1)
    : config.apiBaseUrl;

  return `${baseUrl}/${cleanPath}`;
}
