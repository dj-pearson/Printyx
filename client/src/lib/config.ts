/**
 * Application Configuration
 * Handles environment-specific settings for API endpoints
 *
 * Architecture:
 *   - Frontend: Cloudflare Pages (printyx.net)
 *   - Auth/DB: Self-hosted Supabase (api.printyx.net)
 *   - API: Supabase Edge Functions in Docker (functions.printyx.net)
 */

// Determine API base URL for Edge Function routes
// In production, /api/tasks -> functions.printyx.net/tasks
const getApiBaseUrl = (): string => {
  // Explicit override always wins
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // In production, use Edge Functions
  if (import.meta.env.PROD) {
    return 'https://functions.printyx.net';
  }
  // In development, use relative URLs (Vite proxy handles it)
  return '';
};

export const config = {
  // API Base URL — Edge Functions in production, Vite proxy in dev
  apiBaseUrl: getApiBaseUrl(),

  // Supabase Configuration (self-hosted)
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://api.printyx.net',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    functionsUrl: import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.printyx.net',
  },

  // Feature Flags
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // App Info
  appName: 'Printyx',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;

// Helper to construct full API URLs
// In production, transforms /api/tasks -> functions.printyx.net/tasks
export function getApiUrl(path: string): string {
  // Remove leading slash if present
  let cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // If no base URL is configured, use relative URLs (dev mode with proxy)
  if (!config.apiBaseUrl) {
    return `/${cleanPath}`;
  }

  // For Edge Functions (production), strip the /api/ prefix
  // e.g., /api/tasks -> /tasks, /api/projects -> /projects
  if (config.isProduction && cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(4); // Remove 'api/' prefix
  }

  // Construct full URL (remove trailing slash from base if present)
  const baseUrl = config.apiBaseUrl.endsWith('/')
    ? config.apiBaseUrl.slice(0, -1)
    : config.apiBaseUrl;
  return `${baseUrl}/${cleanPath}`;
}
