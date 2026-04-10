/**
 * Authentication Utility Functions
 *
 * Provides helper functions for authentication flows:
 * - Redirect handling
 * - Route persistence
 * - Session management
 */

import { sanitizeURL } from './validations';

/**
 * Whitelist of allowed redirect paths within the application
 * Routes that users can be redirected to after authentication
 */
const ALLOWED_REDIRECT_PATHS = [
  '/',
  '/dashboard',
  '/customers',
  '/business-records',
  '/leads',
  '/deals',
  '/opportunities',
  '/quotes',
  '/proposals',
  '/service',
  '/service-dispatch',
  '/mobile-field-service',
  '/inventory',
  '/warehouse',
  '/products',
  '/product-hub',
  '/billing',
  '/invoices',
  '/reports',
  '/analytics',
  '/settings',
  '/profile',
  '/integrations',
  '/team',
  '/users',
];

/**
 * Paths that should never be redirect targets
 * Prevents redirect loops and security issues
 */
const BLOCKED_REDIRECT_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/',
  '/api/',
];

/**
 * Get safe redirect route for post-login navigation
 *
 * Priority:
 * 1. Query parameter (?redirect=/path)
 * 2. Saved route from localStorage
 * 3. Fallback route (default: '/')
 *
 * @param queryRedirect - Redirect from URL query parameter
 * @param fallback - Default route if no valid redirect found
 * @returns Safe sanitized redirect path
 */
export function getSafeRedirectRoute(
  queryRedirect: string | null = null,
  fallback: string = '/',
): string {
  // Try query parameter first
  if (queryRedirect) {
    const sanitized = sanitizeURL(queryRedirect);
    if (sanitized !== '/' && isValidRedirect(sanitized)) {
      return sanitized;
    }
  }

  // Try localStorage
  const savedRoute = localStorage.getItem('printyx_last_route');
  if (savedRoute) {
    const sanitized = sanitizeURL(savedRoute);
    if (sanitized !== '/' && isValidRedirect(sanitized)) {
      // Clear after using
      localStorage.removeItem('printyx_last_route');
      return sanitized;
    }
  }

  // Clear any invalid saved route
  localStorage.removeItem('printyx_last_route');

  return fallback;
}

/**
 * Check if a path is a valid redirect target
 *
 * @param path - Path to validate
 * @returns True if path is safe for redirect
 */
export function isValidRedirect(path: string): boolean {
  if (!path || path === '/') {
    return false;
  }

  // Must be relative path
  if (!path.startsWith('/')) {
    return false;
  }

  // Must not be blocked
  if (BLOCKED_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }

  return true;
}

/**
 * Save current route for post-login redirect
 * Only saves valid application routes
 *
 * @param route - Current route path
 */
export function saveRedirectRoute(route: string): void {
  // Don't save if it's not a valid redirect
  if (!isValidRedirect(route)) {
    return;
  }

  // Optionally enforce whitelist
  // const isAllowed = ALLOWED_REDIRECT_PATHS.some(prefix => route.startsWith(prefix));
  // if (!isAllowed) return;

  localStorage.setItem('printyx_last_route', route);
}

/**
 * Clear saved redirect route
 * Call this after successful login/redirect
 */
export function clearRedirectRoute(): void {
  localStorage.removeItem('printyx_last_route');
}

/**
 * Get OAuth redirect URL with preserved destination
 *
 * @param provider - OAuth provider ('google' | 'apple')
 * @param intendedDestination - Where user was trying to go
 * @returns Full callback URL with redirect parameter
 */
export function getOAuthRedirectURL(
  provider: 'google' | 'apple',
  intendedDestination?: string,
): string {
  const origin = window.location.origin;

  // Get safe redirect destination
  const redirect = intendedDestination
    ? getSafeRedirectRoute(intendedDestination, '/')
    : getSafeRedirectRoute(null, '/');

  // Build callback URL with redirect parameter
  const callbackURL = `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;

  return callbackURL;
}

/**
 * Parse redirect parameter from URL
 * Used in auth callback handler
 *
 * @param searchParams - URLSearchParams from window.location
 * @returns Safe redirect path or '/'
 */
export function parseRedirectFromURL(searchParams: URLSearchParams): string {
  const redirect = searchParams.get('redirect');
  return getSafeRedirectRoute(redirect, '/');
}

/**
 * Check if user is on an auth page
 * Used to determine if we should save current route
 *
 * @param path - Current path
 * @returns True if on auth page
 */
export function isAuthPage(path: string): boolean {
  const authPages = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/auth/callback',
  ];

  return authPages.some((page) => path.startsWith(page));
}

/**
 * Format error message from Supabase Auth
 * Provides user-friendly error messages
 *
 * @param error - Error from Supabase
 * @returns Formatted error message
 */
export function formatAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred';

  // Handle Supabase error object
  if (error.message) {
    const message = error.message.toLowerCase();

    if (message.includes('invalid login credentials')) {
      return 'Invalid email or password';
    }

    if (message.includes('email not confirmed')) {
      return 'Please verify your email address before logging in';
    }

    if (message.includes('user already registered')) {
      return 'An account with this email already exists';
    }

    if (message.includes('disposable email')) {
      return 'Disposable email addresses are not allowed. Please sign up with a permanent business email.';
    }

    if (message.includes('invalid email')) {
      return 'Please enter a valid email address';
    }

    if (message.includes('password')) {
      return 'Password does not meet requirements';
    }

    if (message.includes('network')) {
      return 'Network error. Please check your connection and try again';
    }

    // Return original message if no specific match
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Determine if email verification is required
 * Based on Supabase configuration
 *
 * @returns True if email confirmation is enabled
 */
export function requiresEmailVerification(): boolean {
  // In production, email verification should be required
  // In development, it might be disabled for easier testing
  return import.meta.env.PROD || import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION === 'true';
}

/**
 * Get Supabase auth error code
 *
 * @param error - Error from Supabase
 * @returns Error code or null
 */
export function getAuthErrorCode(error: any): string | null {
  return error?.code || error?.errorCode || null;
}

/**
 * Check if error is due to rate limiting
 *
 * @param error - Error from Supabase
 * @returns True if rate limited
 */
export function isRateLimitError(error: any): boolean {
  const code = getAuthErrorCode(error);
  return code === 'rate_limit_exceeded' || code === '429';
}

/**
 * Session storage key for Supabase
 */
export const SUPABASE_AUTH_KEY = 'printyx-auth';

/**
 * Redirect routes storage key
 */
export const REDIRECT_STORAGE_KEY = 'printyx_last_route';

export default {
  getSafeRedirectRoute,
  isValidRedirect,
  saveRedirectRoute,
  clearRedirectRoute,
  getOAuthRedirectURL,
  parseRedirectFromURL,
  isAuthPage,
  formatAuthError,
  requiresEmailVerification,
  getAuthErrorCode,
  isRateLimitError,
  SUPABASE_AUTH_KEY,
  REDIRECT_STORAGE_KEY,
};
