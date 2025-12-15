/**
 * Application Configuration
 * Handles environment-specific settings for API endpoints
 *
 * In production, Supabase requests are proxied through Cloudflare Pages Functions
 * to handle CORS properly. Set VITE_USE_SUPABASE_PROXY=true to enable.
 */

export type AuthMode = 'legacy' | 'hybrid' | 'supabase';

// Determine if we should use the proxy (same-origin requests through Cloudflare Pages Functions)
// Explicitly check for 'false' to allow disabling in production
const useProxy =
  import.meta.env.VITE_USE_SUPABASE_PROXY === 'false'
    ? false
    : import.meta.env.VITE_USE_SUPABASE_PROXY === 'true' || import.meta.env.PROD;

// Get the base URL for the current origin (for proxied requests)
const getOriginUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

// Determine auth mode - default to supabase in production
const resolvedAuthMode: AuthMode = (import.meta.env.VITE_AUTH_MODE as AuthMode) || 'supabase';

export const config = {
  // API Base URL - defaults to relative for dev, can be overridden for production
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',

  // Supabase Configuration
  // In production, use same-origin proxy to avoid CORS issues
  supabase: {
    // Use proxy in production: /api/* routes to Supabase API
    url: useProxy ? getOriginUrl() : import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    // Use proxy in production: /functions/* routes to Supabase Edge Functions
    functionsUrl: useProxy
      ? `${getOriginUrl()}/functions`
      : import.meta.env.VITE_FUNCTIONS_URL || '',
  },

  // Whether Supabase requests are proxied through Cloudflare Pages Functions
  useSupabaseProxy: useProxy,

  // Auth Mode: 'legacy' (Express sessions), 'hybrid' (both), 'supabase' (GoTrue only)
  authMode: resolvedAuthMode,

  // Feature Flags
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // App Info
  appName: 'Printyx',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;

// Debug logging for auth configuration (remove after debugging)
if (typeof window !== 'undefined') {
  console.log('🔐 Auth Config:', {
    authMode: config.authMode,
    useProxy: config.useSupabaseProxy,
    supabaseUrl: config.supabase.url,
    isProduction: config.isProduction,
    envAuthMode: import.meta.env.VITE_AUTH_MODE,
  });
}

// Helper to construct full API URLs
export function getApiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // If no base URL is configured, use relative URLs (dev mode with proxy)
  if (!config.apiBaseUrl) {
    return `/${cleanPath}`;
  }

  // Otherwise, construct full URL (remove trailing slash from base if present)
  const baseUrl = config.apiBaseUrl.endsWith('/')
    ? config.apiBaseUrl.slice(0, -1)
    : config.apiBaseUrl;
  return `${baseUrl}/${cleanPath}`;
}
