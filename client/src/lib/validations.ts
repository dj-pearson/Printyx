/**
 * Input Validation & Sanitization Utilities
 *
 * Provides security-focused validation and sanitization functions to prevent:
 * - XSS (Cross-Site Scripting)
 * - SQL Injection
 * - Open Redirect Attacks
 * - Email Header Injection
 * - Directory Traversal
 *
 * Based on best practices from AUTH_SETUP_DOCUMENTATION.md
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Common Validation
// ============================================================================

/**
 * Enhanced password schema with security requirements
 * Minimum 12 characters with complexity requirements
 */
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Email schema with length limits
 */
export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must not exceed 255 characters')
  .transform((email) => email.toLowerCase().trim());

/**
 * Name schema (first name, last name, company name)
 */
export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .regex(/^[a-zA-Z0-9\s\-'.]+$/, 'Name contains invalid characters');

/**
 * Phone number schema (flexible format)
 */
export const PhoneSchema = z
  .string()
  .max(20, 'Phone number must not exceed 20 characters')
  .regex(/^[0-9+\-() ]+$/, 'Phone number contains invalid characters')
  .optional();

/**
 * URL schema with protocol validation
 */
export const URLSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL must not exceed 2048 characters')
  .regex(/^https?:\/\//, 'URL must use HTTP or HTTPS protocol');

// ============================================================================
// HTML & XSS Prevention
// ============================================================================

/**
 * Remove potentially dangerous HTML tags and attributes
 * Prevents XSS attacks by stripping script tags and event handlers
 *
 * @param input - Raw HTML string
 * @returns Sanitized string with dangerous elements removed
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove script tags and contents
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers (onclick, onerror, etc.)
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (can be used for XSS)
      .replace(/data:text\/html/gi, '')
  );
}

/**
 * Strip all HTML tags from input
 * Use for plain text fields that should never contain markup
 *
 * @param input - String that may contain HTML
 * @returns Plain text with all HTML removed
 */
export function stripHTML(input: string): string {
  if (!input) return '';

  return input
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&lt;/g, '<') // Decode HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .trim();
}

/**
 * Sanitize general text input
 * Removes HTML and potentially dangerous characters
 *
 * @param input - User input string
 * @returns Sanitized string safe for display
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  return stripHTML(input)
    .replace(/[<>'"]/g, '') // Remove remaining dangerous chars
    .trim();
}

// ============================================================================
// Email Security
// ============================================================================

/**
 * Sanitize email address
 * Prevents email header injection and ensures valid format
 *
 * @param email - Email address
 * @returns Sanitized email in lowercase
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';

  return (
    email
      .toLowerCase()
      .trim()
      // Remove any characters that could be used for header injection
      .replace(/[\r\n]/g, '')
      .replace(/[^\w@.-]/g, '')
  );
}

/**
 * Validate email domain against common disposable email providers
 * Optional additional security layer
 *
 * @param email - Email address to check
 * @returns True if email domain is acceptable
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'tempmail.com',
    'guerrillamail.com',
    '10minutemail.com',
    'throwaway.email',
    'maildrop.cc',
    // Add more as needed
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain || '');
}

// ============================================================================
// URL & Redirect Security
// ============================================================================

/**
 * Whitelist of allowed redirect paths within the application
 */
const ALLOWED_REDIRECT_PREFIXES = [
  '/dashboard',
  '/customers',
  '/business-records',
  '/leads',
  '/deals',
  '/opportunities',
  '/service',
  '/inventory',
  '/products',
  '/reports',
  '/settings',
  '/profile',
  '/billing',
  '/analytics',
];

/**
 * Paths that should never be redirect targets
 */
const BLOCKED_REDIRECT_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/api/',
];

/**
 * Sanitize URL for safe redirects
 * Prevents open redirect attacks by validating redirect destinations
 *
 * @param url - URL or path to validate
 * @returns Safe redirect path or default '/'
 */
export function sanitizeURL(url: string): string {
  if (!url) return '/';

  // Decode URL encoding to prevent bypass techniques
  let decoded: string;
  try {
    // Decode multiple times to catch double-encoding
    decoded = decodeURIComponent(decodeURIComponent(url));
  } catch {
    // If decoding fails, reject the URL
    return '/';
  }

  // Must be a relative path starting with /
  if (!decoded.startsWith('/')) {
    return '/';
  }

  // Block protocol-relative URLs (//evil.com)
  if (decoded.startsWith('//')) {
    return '/';
  }

  // Block dangerous protocols
  const lowercase = decoded.toLowerCase();
  if (
    lowercase.includes('javascript:') ||
    lowercase.includes('data:') ||
    lowercase.includes('vbscript:') ||
    lowercase.includes('file:')
  ) {
    return '/';
  }

  // Remove the query string and hash for validation
  const pathOnly = decoded.split('?')[0].split('#')[0];

  // Block auth and API routes
  if (BLOCKED_REDIRECT_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))) {
    return '/';
  }

  // Validate against allowed patterns (alphanumeric, hyphens, underscores, slashes)
  if (!/^[a-zA-Z0-9\-_/]+$/.test(pathOnly)) {
    return '/';
  }

  // Optionally enforce whitelist (commented out for flexibility)
  // const isAllowed = ALLOWED_REDIRECT_PREFIXES.some(prefix => pathOnly.startsWith(prefix));
  // if (!isAllowed) return '/';

  return decoded;
}

/**
 * Validate external URL for safety
 * Use when accepting URLs from user input (e.g., company website)
 *
 * @param url - URL to validate
 * @returns True if URL is safe
 */
export function isValidExternalURL(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    // Only allow HTTP and HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// File & Path Security
// ============================================================================

/**
 * Sanitize filename for safe storage
 * Prevents directory traversal and file system exploits
 *
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';

  return (
    filename
      // Remove directory separators
      .replace(/[/\\]/g, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')
      // Remove potentially dangerous characters
      .replace(/[<>:"|?*]/g, '')
      // Remove leading/trailing dots and spaces
      .replace(/^[.\s]+|[.\s]+$/g, '')
      // Limit length
      .slice(0, 255) ||
    // Ensure we still have a filename
    'unnamed'
  );
}

/**
 * Validate file extension against whitelist
 *
 * @param filename - Filename with extension
 * @param allowedExtensions - Array of allowed extensions (e.g., ['jpg', 'png'])
 * @returns True if extension is allowed
 */
export function isAllowedFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

// ============================================================================
// SQL Injection Prevention
// ============================================================================

/**
 * Escape special characters for SQL LIKE queries
 * Note: Always use parameterized queries. This is a defense-in-depth measure.
 *
 * @param input - Search term for LIKE query
 * @returns Escaped string
 */
export function escapeSQLLike(input: string): string {
  if (!input) return '';

  return input
    .replace(/\\/g, '\\\\') // Escape backslash
    .replace(/%/g, '\\%') // Escape percent
    .replace(/_/g, '\\_') // Escape underscore
    .replace(/'/g, "''"); // Escape single quote
}

// ============================================================================
// Password Strength Calculation
// ============================================================================

export interface PasswordStrength {
  score: number; // 0-5
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
}

/**
 * Calculate password strength with real-time feedback
 * Returns score and missing requirements
 *
 * @param password - Password to evaluate
 * @returns PasswordStrength object
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const feedback: string[] = [];

  if (!password) {
    return {
      score: 0,
      level: 'very-weak',
      feedback: ['Password is required'],
    };
  }

  // Length check
  if (password.length >= 12) {
    score++;
  } else {
    feedback.push(`At least 12 characters (${password.length}/12)`);
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('One uppercase letter');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('One lowercase letter');
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('One number');
  }

  // Special character check
  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('One special character (!@#$%^&*)');
  }

  // Determine level
  let level: PasswordStrength['level'];
  if (score === 5) {
    level = 'strong';
  } else if (score === 4) {
    level = 'good';
  } else if (score === 3) {
    level = 'fair';
  } else if (score === 2) {
    level = 'weak';
  } else {
    level = 'very-weak';
  }

  return { score, level, feedback };
}

// ============================================================================
// Safe Redirect Helper
// ============================================================================

/**
 * Get safe redirect route for post-login navigation
 * Combines sanitization with localStorage retrieval
 *
 * @param fallback - Default route if no saved route exists
 * @returns Safe redirect path
 */
export function getSafeRedirectRoute(fallback: string = '/'): string {
  const savedRoute = localStorage.getItem('printyx_last_route');

  if (!savedRoute) {
    return fallback;
  }

  const sanitized = sanitizeURL(savedRoute);

  // Clear the stored route after using it
  localStorage.removeItem('printyx_last_route');

  return sanitized;
}

/**
 * Save current route for post-login redirect
 * Only saves if it's a valid application route
 *
 * @param route - Current route path
 */
export function saveRedirectRoute(route: string): void {
  // Don't save auth pages
  if (BLOCKED_REDIRECT_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return;
  }

  // Don't save if it's already the default
  if (route === '/' || route === '') {
    return;
  }

  localStorage.setItem('printyx_last_route', route);
}

// ============================================================================
// Export All
// ============================================================================

export default {
  // Schemas
  PasswordSchema,
  EmailSchema,
  NameSchema,
  PhoneSchema,
  URLSchema,

  // HTML sanitization
  sanitizeHTML,
  stripHTML,
  sanitizeInput,

  // Email
  sanitizeEmail,
  isDisposableEmail,

  // URLs
  sanitizeURL,
  isValidExternalURL,

  // Files
  sanitizeFilename,
  isAllowedFileExtension,

  // SQL
  escapeSQLLike,

  // Password
  calculatePasswordStrength,

  // Redirects
  getSafeRedirectRoute,
  saveRedirectRoute,
};
