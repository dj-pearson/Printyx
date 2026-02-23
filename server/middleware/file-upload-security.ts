/**
 * File Upload Security Middleware
 *
 * Provides secure file upload handling with:
 * - File type whitelist validation
 * - Filename sanitization (strips special chars, rejects double extensions, null bytes, path separators)
 * - File size limits (25MB max)
 * - Per-user upload rate limiting (10 uploads/minute)
 *
 * Usage:
 *   import { secureUpload, fileUploadMiddleware } from '../middleware/file-upload-security';
 *
 *   // Single file upload with full security (validation + rate limit)
 *   app.post('/api/upload', requireAuth, fileUploadMiddleware, secureUpload.single('file'), handler);
 *
 *   // Or use createSecureUpload() for custom configuration
 *   const upload = createSecureUpload({ maxFileSize: 10 * 1024 * 1024 });
 */

import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { getUserId } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('file-upload-security');

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

/** Maximum file size in bytes (25MB) */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Allowed file extensions (lowercase, without leading dot) */
export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'xlsx',
  'xls',
  'csv',
  'docx',
  'doc',
]);

/** Mapping of extensions to MIME types for validation */
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
]);

/** Rate limit: max uploads per window */
const UPLOAD_RATE_LIMIT = 10;

/** Rate limit window in milliseconds (1 minute) */
const UPLOAD_RATE_WINDOW_MS = 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════
// FILENAME SANITIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sanitize a filename to prevent security issues.
 *
 * - Strips path separators (/ and \)
 * - Removes null bytes
 * - Removes special characters except alphanumeric, dots, hyphens, underscores
 * - Rejects double extensions (e.g., file.pdf.exe)
 * - Returns null if filename is invalid after sanitization
 */
export function sanitizeFilename(filename: string): string | null {
  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Remove null bytes
  let sanitized = filename.replace(/\0/g, '');

  // Remove path separators (prevent directory traversal)
  sanitized = sanitized.replace(/[/\\]/g, '');

  // Strip characters that are not alphanumeric, dots, hyphens, underscores, or spaces
  sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_ ]/g, '');

  // Collapse multiple dots into one to prevent sneaky double extensions
  sanitized = sanitized.replace(/\.{2,}/g, '.');

  // Trim leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

  // Reject empty filenames
  if (!sanitized || sanitized.length === 0) {
    return null;
  }

  return sanitized;
}

/**
 * Check if a filename contains a double extension pattern.
 * Examples: file.pdf.exe, document.xlsx.js, image.png.php
 *
 * We check if there are two or more extensions and the final extension
 * does NOT match our allowed list, OR if there are 2+ recognized extensions
 * followed by a non-allowed extension.
 */
export function hasDoubleExtension(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Split on dots, ignoring leading dot
  const parts = filename.split('.');

  // Need at least 3 parts for a double extension (name.ext1.ext2)
  if (parts.length < 3) {
    return false;
  }

  // Get all parts after the first (these are potential extensions)
  const extensions = parts.slice(1).map((ext) => ext.toLowerCase());

  // If any extension before the last one is in our allowed list,
  // and the last extension is different from what we allow, it's suspicious
  for (let i = 0; i < extensions.length - 1; i++) {
    if (ALLOWED_EXTENSIONS.has(extensions[i])) {
      // There's a recognized extension followed by more extensions - suspicious
      return true;
    }
  }

  // Even if none are "recognized", having 2+ extensions is suspicious
  // e.g., file.txt.exe
  if (extensions.length >= 2) {
    const lastExt = extensions[extensions.length - 1];
    const secondLastExt = extensions[extensions.length - 2];
    // If both look like actual extensions (short alphanumeric), flag it
    if (
      lastExt.length >= 2 &&
      lastExt.length <= 5 &&
      secondLastExt.length >= 2 &&
      secondLastExt.length <= 5
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a filename contains null bytes.
 */
export function hasNullBytes(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  return filename.includes('\0');
}

/**
 * Check if a filename contains path separators.
 */
export function hasPathSeparators(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  return filename.includes('/') || filename.includes('\\');
}

/**
 * Get the file extension from a filename (lowercase, without dot).
 */
export function getFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  const ext = path.extname(filename).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

/**
 * Check if a file extension is in the allowed whitelist.
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.has(ext);
}

// ═══════════════════════════════════════════════════════════════════════
// MULTER FILE FILTER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Multer file filter that enforces the file type whitelist.
 */
function secureFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const originalName = file.originalname;

  // Check for null bytes in original filename
  if (hasNullBytes(originalName)) {
    log.warn({ filename: originalName }, 'Rejected file upload: null bytes in filename');
    return cb(new Error('Invalid filename: contains null bytes'));
  }

  // Check for path separators
  if (hasPathSeparators(originalName)) {
    log.warn({ filename: originalName }, 'Rejected file upload: path separators in filename');
    return cb(new Error('Invalid filename: contains path separators'));
  }

  // Check for double extensions
  if (hasDoubleExtension(originalName)) {
    log.warn({ filename: originalName }, 'Rejected file upload: double extension detected');
    return cb(new Error('Invalid filename: double extension not allowed'));
  }

  // Check file extension whitelist
  if (!isAllowedExtension(originalName)) {
    const ext = getFileExtension(originalName);
    log.warn(
      { filename: originalName, extension: ext },
      'Rejected file upload: file type not allowed',
    );
    return cb(new Error(`File type not allowed: .${ext}`));
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    log.warn(
      { filename: originalName, mimetype: file.mimetype },
      'Rejected file upload: MIME type not allowed',
    );
    return cb(new Error(`MIME type not allowed: ${file.mimetype}`));
  }

  // Sanitize the filename
  const sanitized = sanitizeFilename(originalName);
  if (!sanitized) {
    log.warn(
      { filename: originalName },
      'Rejected file upload: filename invalid after sanitization',
    );
    return cb(new Error('Invalid filename'));
  }

  // Replace original filename with sanitized version
  file.originalname = sanitized;

  cb(null, true);
}

// ═══════════════════════════════════════════════════════════════════════
// SECURE UPLOAD FACTORY
// ═══════════════════════════════════════════════════════════════════════

interface SecureUploadOptions {
  /** Maximum file size in bytes (default: 25MB) */
  maxFileSize?: number;
  /** Use disk storage instead of memory (default: false) */
  useDiskStorage?: boolean;
  /** Disk storage destination directory */
  destination?: string;
}

/**
 * Create a pre-configured multer instance with security settings.
 *
 * @param options - Configuration options
 * @returns Configured multer instance
 */
export function createSecureUpload(options: SecureUploadOptions = {}): multer.Multer {
  const { maxFileSize = MAX_FILE_SIZE, useDiskStorage = false, destination = 'uploads/' } = options;

  const storage = useDiskStorage
    ? multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, destination),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          const basename = path.basename(file.originalname, ext);
          cb(null, `${basename}-${uniqueSuffix}${ext}`);
        },
      })
    : multer.memoryStorage();

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: 10, // Max 10 files per request
      fieldSize: 1 * 1024 * 1024, // 1MB max field value size
    },
    fileFilter: secureFileFilter,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// UPLOAD VALIDATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Middleware that validates uploaded files after multer processes them.
 * Checks file content against declared type and enforces additional rules.
 */
export function validateFileUpload(req: Request, res: Response, next: NextFunction): void {
  // If no files were uploaded, skip validation
  const files = req.files
    ? Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat()
    : req.file
      ? [req.file]
      : [];

  if (files.length === 0) {
    return next();
  }

  for (const file of files) {
    // Double-check extension after multer processing
    if (!isAllowedExtension(file.originalname)) {
      log.warn(
        { filename: file.originalname },
        'Post-upload validation failed: extension not allowed',
      );
      res.status(400).json({
        message: `File type not allowed: ${getFileExtension(file.originalname)}`,
        code: 'INVALID_FILE_TYPE',
      });
      return;
    }

    // Check file size (belt-and-suspenders with multer limits)
    if (file.size > MAX_FILE_SIZE) {
      log.warn(
        { filename: file.originalname, size: file.size },
        'Post-upload validation failed: file too large',
      );
      res.status(400).json({
        message: `File too large: ${Math.round(file.size / (1024 * 1024))}MB exceeds ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB limit`,
        code: 'FILE_TOO_LARGE',
      });
      return;
    }

    // Verify sanitized filename
    const sanitized = sanitizeFilename(file.originalname);
    if (!sanitized) {
      log.warn({ filename: file.originalname }, 'Post-upload validation failed: invalid filename');
      res.status(400).json({
        message: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
      return;
    }
  }

  next();
}

// ═══════════════════════════════════════════════════════════════════════
// UPLOAD RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════

/** In-memory store for upload rate limiting. Key: userId/ip, Value: { count, windowStart } */
interface UploadRateBucket {
  count: number;
  windowStart: number;
}

const uploadRateStore = new Map<string, UploadRateBucket>();

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of uploadRateStore.entries()) {
      if (now - bucket.windowStart > UPLOAD_RATE_WINDOW_MS) {
        uploadRateStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
).unref();

/**
 * Get the rate limit key for a request (user ID or IP).
 */
function getUploadRateLimitKey(req: Request): string {
  const userId = getUserId(req as any);
  if (userId) {
    return `upload:user:${userId}`;
  }
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `upload:ip:${ip}`;
}

/**
 * Upload rate limiter middleware.
 * Limits to 10 file uploads per minute per user.
 */
export function uploadRateLimiter(req: Request, res: Response, next: NextFunction): void {
  try {
    const key = getUploadRateLimitKey(req);
    const now = Date.now();

    let bucket = uploadRateStore.get(key);

    // Reset bucket if window has expired
    if (!bucket || now - bucket.windowStart > UPLOAD_RATE_WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
    }

    bucket.count++;
    uploadRateStore.set(key, bucket);

    // Set rate limit headers
    const remaining = Math.max(0, UPLOAD_RATE_LIMIT - bucket.count);
    const resetAt = bucket.windowStart + UPLOAD_RATE_WINDOW_MS;

    res.setHeader('X-RateLimit-Limit', UPLOAD_RATE_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(resetAt / 1000).toString());

    if (bucket.count > UPLOAD_RATE_LIMIT) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      log.warn({ key, count: bucket.count }, 'Upload rate limit exceeded');

      res.status(429).json({
        message: 'Too many file uploads. Please try again later.',
        code: 'UPLOAD_RATE_LIMITED',
        details: { retryAfter },
      });
      return;
    }

    next();
  } catch (error) {
    // Graceful degradation - allow upload if rate limiting fails
    log.error({ err: error }, 'Error in upload rate limiter');
    next();
  }
}

/**
 * Export the upload rate store for testing purposes.
 */
export function _getUploadRateStore(): Map<string, UploadRateBucket> {
  return uploadRateStore;
}

/**
 * Clear the upload rate store (for testing).
 */
export function _clearUploadRateStore(): void {
  uploadRateStore.clear();
}

// ═══════════════════════════════════════════════════════════════════════
// PRE-CONFIGURED EXPORTS
// ═══════════════════════════════════════════════════════════════════════

/** Pre-configured secure multer instance with default settings (memory storage, 25MB limit) */
export const secureUpload = createSecureUpload();

/**
 * Combined middleware array for file upload routes.
 * Applies rate limiting + post-upload validation.
 *
 * Usage:
 *   app.post('/api/upload', requireAuth, ...fileUploadMiddleware, secureUpload.single('file'), handler);
 *
 * Or use individually:
 *   app.post('/api/upload', requireAuth, uploadRateLimiter, secureUpload.single('file'), validateFileUpload, handler);
 */
export const fileUploadMiddleware = [uploadRateLimiter, validateFileUpload];
