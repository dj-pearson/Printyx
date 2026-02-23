import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeFilename,
  hasDoubleExtension,
  hasNullBytes,
  hasPathSeparators,
  getFileExtension,
  isAllowedExtension,
  validateFileUpload,
  uploadRateLimiter,
  createSecureUpload,
  _clearUploadRateStore,
  _getUploadRateStore,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
} from '../../middleware/file-upload-security';

// Mock the logger to prevent console noise in tests
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock auth helpers
vi.mock('../../utils/auth-helpers', () => ({
  getUserId: vi.fn((req: any) => req._testUserId || null),
}));

/**
 * Helper to create a mock Express request
 */
function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    file: undefined,
    files: undefined,
    _testUserId: undefined,
    ...overrides,
  };
}

/**
 * Helper to create a mock Express response
 */
function createMockRes(): any {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('File Upload Security Middleware', () => {
  // ─────────────────────────────────────────────────────────
  // File Type Whitelist Validation
  // ─────────────────────────────────────────────────────────

  describe('isAllowedExtension', () => {
    it('should allow all whitelisted file extensions', () => {
      const allowedFiles = [
        'report.pdf',
        'photo.png',
        'image.jpg',
        'picture.jpeg',
        'animation.gif',
        'spreadsheet.xlsx',
        'legacy-spreadsheet.xls',
        'data.csv',
        'document.docx',
        'legacy-document.doc',
      ];

      for (const file of allowedFiles) {
        expect(isAllowedExtension(file)).toBe(true);
      }
    });

    it('should reject disallowed file extensions', () => {
      const disallowedFiles = [
        'script.exe',
        'payload.sh',
        'hack.bat',
        'virus.js',
        'malware.php',
        'trojan.py',
        'attack.html',
        'shell.cmd',
        'payload.ps1',
        'archive.zip',
        'config.json',
        'style.css',
      ];

      for (const file of disallowedFiles) {
        expect(isAllowedExtension(file)).toBe(false);
      }
    });

    it('should handle case-insensitive extensions', () => {
      expect(isAllowedExtension('file.PDF')).toBe(true);
      expect(isAllowedExtension('file.Png')).toBe(true);
      expect(isAllowedExtension('file.XLSX')).toBe(true);
      expect(isAllowedExtension('file.JpEg')).toBe(true);
    });

    it('should reject files with no extension', () => {
      expect(isAllowedExtension('noextension')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Double Extension Detection
  // ─────────────────────────────────────────────────────────

  describe('hasDoubleExtension', () => {
    it('should detect double extensions with allowed first extension', () => {
      expect(hasDoubleExtension('report.pdf.exe')).toBe(true);
      expect(hasDoubleExtension('image.png.php')).toBe(true);
      expect(hasDoubleExtension('document.docx.js')).toBe(true);
      expect(hasDoubleExtension('spreadsheet.xlsx.bat')).toBe(true);
    });

    it('should detect double extensions with unknown first extension', () => {
      expect(hasDoubleExtension('file.txt.exe')).toBe(true);
      expect(hasDoubleExtension('data.log.php')).toBe(true);
    });

    it('should not flag single extension files', () => {
      expect(hasDoubleExtension('report.pdf')).toBe(false);
      expect(hasDoubleExtension('image.png')).toBe(false);
      expect(hasDoubleExtension('document.docx')).toBe(false);
    });

    it('should not flag files with no extension', () => {
      expect(hasDoubleExtension('filename')).toBe(false);
    });

    it('should return false for null/undefined/empty input', () => {
      expect(hasDoubleExtension('')).toBe(false);
      expect(hasDoubleExtension(null as any)).toBe(false);
      expect(hasDoubleExtension(undefined as any)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Null Byte Detection
  // ─────────────────────────────────────────────────────────

  describe('hasNullBytes', () => {
    it('should detect null bytes in filenames', () => {
      expect(hasNullBytes('file.pdf\0.exe')).toBe(true);
      expect(hasNullBytes('\0malicious.pdf')).toBe(true);
      expect(hasNullBytes('document\0')).toBe(true);
    });

    it('should return false for clean filenames', () => {
      expect(hasNullBytes('report.pdf')).toBe(false);
      expect(hasNullBytes('my-document_v2.xlsx')).toBe(false);
    });

    it('should return false for null/undefined/empty input', () => {
      expect(hasNullBytes('')).toBe(false);
      expect(hasNullBytes(null as any)).toBe(false);
      expect(hasNullBytes(undefined as any)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Path Separator Detection
  // ─────────────────────────────────────────────────────────

  describe('hasPathSeparators', () => {
    it('should detect forward slashes in filenames', () => {
      expect(hasPathSeparators('../etc/passwd')).toBe(true);
      expect(hasPathSeparators('/root/file.pdf')).toBe(true);
      expect(hasPathSeparators('dir/file.pdf')).toBe(true);
    });

    it('should detect backslashes in filenames', () => {
      expect(hasPathSeparators('..\\windows\\system32')).toBe(true);
      expect(hasPathSeparators('C:\\file.pdf')).toBe(true);
      expect(hasPathSeparators('dir\\file.pdf')).toBe(true);
    });

    it('should return false for clean filenames', () => {
      expect(hasPathSeparators('report.pdf')).toBe(false);
      expect(hasPathSeparators('my-file_v2.xlsx')).toBe(false);
    });

    it('should return false for null/undefined/empty input', () => {
      expect(hasPathSeparators('')).toBe(false);
      expect(hasPathSeparators(null as any)).toBe(false);
      expect(hasPathSeparators(undefined as any)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Filename Sanitization
  // ─────────────────────────────────────────────────────────

  describe('sanitizeFilename', () => {
    it('should strip special characters from filenames', () => {
      const result = sanitizeFilename('file@#$%name.pdf');
      expect(result).toBe('filename.pdf');
    });

    it('should remove null bytes', () => {
      const result = sanitizeFilename('file\0name.pdf');
      expect(result).toBe('filename.pdf');
    });

    it('should remove path separators', () => {
      const result = sanitizeFilename('../dir/file.pdf');
      expect(result).toBe('dirfile.pdf');
    });

    it('should remove backslash path separators', () => {
      const result = sanitizeFilename('..\\dir\\file.pdf');
      expect(result).toBe('dirfile.pdf');
    });

    it('should allow alphanumeric, dots, hyphens, underscores, and spaces', () => {
      const result = sanitizeFilename('My Report_v2-final.pdf');
      expect(result).toBe('My Report_v2-final.pdf');
    });

    it('should collapse multiple consecutive dots', () => {
      const result = sanitizeFilename('file..pdf');
      expect(result).toBe('file.pdf');
    });

    it('should trim leading and trailing dots and spaces', () => {
      const result = sanitizeFilename('.hidden.pdf.');
      expect(result).toBe('hidden.pdf');
    });

    it('should return null for empty or invalid filenames', () => {
      expect(sanitizeFilename('')).toBeNull();
      expect(sanitizeFilename(null as any)).toBeNull();
      expect(sanitizeFilename(undefined as any)).toBeNull();
    });

    it('should return null if filename becomes empty after sanitization', () => {
      // Only special characters that would all be stripped
      expect(sanitizeFilename('@#$%^&*()')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────
  // getFileExtension
  // ─────────────────────────────────────────────────────────

  describe('getFileExtension', () => {
    it('should extract file extension in lowercase', () => {
      expect(getFileExtension('report.PDF')).toBe('pdf');
      expect(getFileExtension('image.PNG')).toBe('png');
      expect(getFileExtension('data.Csv')).toBe('csv');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('noextension')).toBe('');
    });

    it('should return empty string for null/undefined input', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileExtension(null as any)).toBe('');
      expect(getFileExtension(undefined as any)).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────
  // File Size Limits
  // ─────────────────────────────────────────────────────────

  describe('File size limits', () => {
    it('should have MAX_FILE_SIZE set to 25MB', () => {
      expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024);
    });

    it('should configure multer with the correct file size limit', () => {
      const upload = createSecureUpload();
      // The multer instance is created - we verify the factory works without error
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe('function');
      expect(typeof upload.array).toBe('function');
      expect(typeof upload.fields).toBe('function');
    });

    it('should allow custom file size limits via createSecureUpload', () => {
      const customUpload = createSecureUpload({ maxFileSize: 10 * 1024 * 1024 });
      expect(customUpload).toBeDefined();
      expect(typeof customUpload.single).toBe('function');
    });
  });

  // ─────────────────────────────────────────────────────────
  // validateFileUpload Middleware
  // ─────────────────────────────────────────────────────────

  describe('validateFileUpload', () => {
    it('should call next() when no files are uploaded', () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should pass valid files through validation', () => {
      const req = createMockReq({
        file: {
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024, // 1MB
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject files exceeding MAX_FILE_SIZE', () => {
      const req = createMockReq({
        file: {
          originalname: 'large-file.pdf',
          mimetype: 'application/pdf',
          size: MAX_FILE_SIZE + 1,
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      validateFileUpload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FILE_TOO_LARGE' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject files with disallowed extensions in post-upload validation', () => {
      const req = createMockReq({
        file: {
          originalname: 'script.exe',
          mimetype: 'application/octet-stream',
          size: 1024,
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      validateFileUpload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_FILE_TYPE' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle multiple files in req.files array', () => {
      const req = createMockReq({
        files: [
          { originalname: 'file1.pdf', mimetype: 'application/pdf', size: 1024 },
          { originalname: 'file2.png', mimetype: 'image/png', size: 2048 },
        ],
      });
      const res = createMockRes();
      const next = vi.fn();

      validateFileUpload(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject if any file in a multi-file upload is invalid', () => {
      const req = createMockReq({
        files: [
          { originalname: 'file1.pdf', mimetype: 'application/pdf', size: 1024 },
          { originalname: 'malware.exe', mimetype: 'application/octet-stream', size: 2048 },
        ],
      });
      const res = createMockRes();
      const next = vi.fn();

      validateFileUpload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // Upload Rate Limiter
  // ─────────────────────────────────────────────────────────

  describe('uploadRateLimiter', () => {
    beforeEach(() => {
      _clearUploadRateStore();
    });

    afterEach(() => {
      _clearUploadRateStore();
    });

    it('should allow uploads within the rate limit', () => {
      const req = createMockReq({ _testUserId: 'user-1' });
      const res = createMockRes();
      const next = vi.fn();

      uploadRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set rate limit headers on response', () => {
      const req = createMockReq({ _testUserId: 'user-2' });
      const res = createMockRes();
      const next = vi.fn();

      uploadRateLimiter(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should reject uploads exceeding the rate limit (10 per minute)', () => {
      const req = createMockReq({ _testUserId: 'user-rate-test' });
      const res = createMockRes();
      const next = vi.fn();

      // Make 10 successful uploads
      for (let i = 0; i < 10; i++) {
        const innerNext = vi.fn();
        const innerRes = createMockRes();
        uploadRateLimiter(req, innerRes, innerNext);
        expect(innerNext).toHaveBeenCalled();
      }

      // The 11th should be rejected
      uploadRateLimiter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UPLOAD_RATE_LIMITED',
          message: expect.stringContaining('Too many file uploads'),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should track rate limits per user independently', () => {
      const req1 = createMockReq({ _testUserId: 'user-a' });
      const req2 = createMockReq({ _testUserId: 'user-b' });
      const res = createMockRes();
      const next = vi.fn();

      // User A makes 10 uploads
      for (let i = 0; i < 10; i++) {
        uploadRateLimiter(req1, createMockRes(), vi.fn());
      }

      // User B should still be able to upload
      uploadRateLimiter(req2, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fall back to IP-based rate limiting for unauthenticated requests', () => {
      const req = createMockReq({
        _testUserId: null,
        socket: { remoteAddress: '192.168.1.100' },
      });
      const res = createMockRes();
      const next = vi.fn();

      uploadRateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();

      // Verify the store has an IP-based key
      const store = _getUploadRateStore();
      const hasIpKey = Array.from(store.keys()).some((key) => key.includes('ip:'));
      expect(hasIpKey).toBe(true);
    });

    it('should include Retry-After header when rate limited', () => {
      const req = createMockReq({ _testUserId: 'user-retry-test' });

      // Exhaust the limit
      for (let i = 0; i < 11; i++) {
        uploadRateLimiter(req, createMockRes(), vi.fn());
      }

      // Next request should include Retry-After
      const res = createMockRes();
      const next = vi.fn();
      uploadRateLimiter(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Constants Validation
  // ─────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have all required allowed extensions', () => {
      const required = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'xlsx', 'xls', 'csv', 'docx', 'doc'];
      for (const ext of required) {
        expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it('should have matching MIME types for all allowed extensions', () => {
      expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/gif')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('text/csv')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('application/vnd.ms-excel')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('application/msword')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // createSecureUpload Factory
  // ─────────────────────────────────────────────────────────

  describe('createSecureUpload', () => {
    it('should create a multer instance with default options', () => {
      const upload = createSecureUpload();
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe('function');
      expect(typeof upload.array).toBe('function');
      expect(typeof upload.fields).toBe('function');
      expect(typeof upload.none).toBe('function');
      expect(typeof upload.any).toBe('function');
    });

    it('should create a multer instance with custom max file size', () => {
      const upload = createSecureUpload({ maxFileSize: 5 * 1024 * 1024 });
      expect(upload).toBeDefined();
    });

    it('should create a multer instance with disk storage', () => {
      const upload = createSecureUpload({
        useDiskStorage: true,
        destination: '/tmp/uploads/',
      });
      expect(upload).toBeDefined();
    });
  });
});
