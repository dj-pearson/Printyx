/**
 * Input Sanitization Middleware
 *
 * Processes all req.body, req.query, and req.params string values to:
 * - Strip HTML tags from inputs (prevents stored XSS)
 * - Remove null bytes and control characters
 * - Reject path traversal patterns (../, %2e%2e)
 * - Allow rich HTML for whitelisted fields via DOMPurify
 */

import type { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Fields that are allowed to contain rich HTML content
const RICH_HTML_FIELDS = new Set([
  'emailBody',
  'emailHtml',
  'htmlContent',
  'richDescription',
  'kbContent',
  'articleBody',
  'templateHtml',
  'signatureHtml',
]);

// DOMPurify config for rich HTML fields - allow safe subset
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'b',
    'i',
    'u',
    'em',
    'strong',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
    'span',
    'div',
    'hr',
    'sub',
    'sup',
    'mark',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'style',
    'target',
    'rel',
    'width',
    'height',
    'colspan',
    'rowspan',
    'align',
    'valign',
  ],
  ALLOW_DATA_ATTR: false,
};

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e/i,
  /%252e%252e/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
];

/**
 * Strip all HTML tags from a string
 */
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Remove null bytes and control characters (except whitespace: \t \n \r)
 */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Check if a string contains path traversal patterns
 */
function containsPathTraversal(value: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Sanitize a single string value
 */
function sanitizeString(value: string, fieldName?: string): string {
  // Strip null bytes and control characters first
  let clean = stripControlChars(value);

  // For whitelisted rich HTML fields, use DOMPurify to allow safe subset
  if (fieldName && RICH_HTML_FIELDS.has(fieldName)) {
    clean = DOMPurify.sanitize(clean, DOMPURIFY_CONFIG);
  } else {
    // Strip all HTML tags for regular fields
    clean = stripHtml(clean);
  }

  return clean;
}

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj: any, parentKey?: string): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj, parentKey);
  }

  if (Array.isArray(obj)) {
    return obj.map((item, idx) => sanitizeObject(item, parentKey));
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeObject(obj[key], key);
    }
    return result;
  }

  return obj;
}

/**
 * Check all string values in an object for path traversal
 */
function checkPathTraversal(obj: any): boolean {
  if (obj === null || obj === undefined) return false;

  if (typeof obj === 'string') {
    return containsPathTraversal(obj);
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => checkPathTraversal(item));
  }

  if (typeof obj === 'object') {
    return Object.values(obj).some((val) => checkPathTraversal(val));
  }

  return false;
}

/**
 * Input sanitization middleware
 *
 * Apply globally after body parsers to sanitize all incoming string data.
 */
export function inputSanitization(req: Request, res: Response, next: NextFunction): void {
  // Check path traversal in params, query, and body
  if (
    checkPathTraversal(req.params) ||
    checkPathTraversal(req.query) ||
    checkPathTraversal(req.body)
  ) {
    res.status(400).json({
      message: 'Invalid input: path traversal pattern detected',
      code: 'PATH_TRAVERSAL_DETECTED',
    });
    return;
  }

  // Sanitize params
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  // Sanitize query
  if (req.query && typeof req.query === 'object') {
    (req as any).query = sanitizeObject(req.query);
  }

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
}

// Export internals for testing
export {
  sanitizeString,
  sanitizeObject,
  checkPathTraversal,
  stripHtml,
  stripControlChars,
  RICH_HTML_FIELDS,
};
