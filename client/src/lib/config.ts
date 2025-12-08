/**
 * Application Configuration
 * Handles environment-specific settings for API endpoints
 */

export const config = {
  // API Base URL - defaults to relative for dev, can be overridden for production
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',

  // Supabase Configuration (if using Supabase client directly)
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },

  // Feature Flags
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // App Info
  appName: 'Printyx',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;

// Helper to construct full API URLs
export function getApiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // If no base URL is configured, use relative URLs (dev mode with proxy)
  if (!config.apiBaseUrl) {
    return `/${cleanPath}`;
  }

  // Otherwise, construct full URL
  return `${config.apiBaseUrl}/${cleanPath}`;
}
