/**
 * Unit Tests: Error Sanitization (SEC-015)
 *
 * Validates that sensitive information is scrubbed from error messages
 * before being returned to API consumers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeErrorMessage,
  sanitizeErrorForProduction,
  stripSensitiveHeaders,
} from '../../utils/error-sanitizer';
import { globalErrorHandler } from '../../middleware/error-handler';
import { AppError } from '../../lib/api-errors';
import { createMockReq, createMockRes, createMockNext } from '../helpers/test-utils';

// Mock loggers
vi.mock('../../lib/logger', () => ({
  createModuleLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  }),
}));

vi.mock('../../lib/monitoring', () => ({
  createModuleLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  }),
}));

// ─── sanitizeErrorMessage ────────────────────────────────────────────

describe('sanitizeErrorMessage', () => {
  it('should scrub PostgreSQL column names from error messages', () => {
    const msg = 'null value in column "user_password" violates not-null constraint';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('user_password');
    expect(result).toContain('column [redacted]');
  });

  it('should scrub PostgreSQL table names from error messages', () => {
    const msg = 'insert or update on table "users" violates foreign key constraint';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('"users"');
    expect(result).toContain('table [redacted]');
  });

  it('should scrub PostgreSQL constraint names', () => {
    const msg = 'duplicate key value violates unique constraint "users_email_key"';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('users_email_key');
    expect(result).toContain('constraint [redacted]');
  });

  it('should scrub PostgreSQL relation names', () => {
    const msg = 'relation "secret_table" does not exist';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('secret_table');
    expect(result).toContain('relation [redacted]');
  });

  it('should scrub PostgreSQL Detail and Hint lines', () => {
    const msg = 'Key already exists. Detail: Key (email)=(admin@test.com) already exists.';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('Detail:');
    expect(result).not.toContain('admin@test.com');
  });

  it('should remove /home/ file paths from error messages', () => {
    const msg = 'Error loading module at /home/user/Printyx/server/routes.ts:42';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('/home/user');
    expect(result).toContain('[path-redacted]');
  });

  it('should remove /app/ file paths from error messages', () => {
    const msg = 'Cannot find module /app/node_modules/express/lib/router.js';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('/app/node_modules');
    expect(result).toContain('[path-redacted]');
  });

  it('should remove /server/ file paths from error messages', () => {
    const msg = 'ENOENT: no such file at /server/config/secrets.json';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('/server/config');
    expect(result).toContain('[path-redacted]');
  });

  it('should remove /usr/ and /var/ file paths from error messages', () => {
    const msg = 'Permission denied /usr/local/bin/node and /var/log/app.log';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('/usr/local');
    expect(result).not.toContain('/var/log');
  });

  it('should remove internal IPv4 addresses (10.x)', () => {
    const msg = 'Connection refused to 10.0.1.50:5432';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('10.0.1.50');
    expect(result).toContain('[ip-redacted]');
  });

  it('should remove internal IPv4 addresses (192.168.x)', () => {
    const msg = 'Cannot reach host 192.168.1.100';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('192.168.1.100');
    expect(result).toContain('[ip-redacted]');
  });

  it('should remove internal IPv4 addresses (172.16-31.x)', () => {
    const msg = 'Timeout connecting to 172.16.0.5';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('172.16.0.5');
    expect(result).toContain('[ip-redacted]');
  });

  it('should remove loopback addresses (127.x)', () => {
    const msg = 'ECONNREFUSED 127.0.0.1:3000';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('127.0.0.1');
    expect(result).toContain('[ip-redacted]');
  });

  it('should remove internal hostnames (.internal, .local)', () => {
    const msg = 'DNS lookup failed for db-primary.internal';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('db-primary.internal');
    expect(result).toContain('[host-redacted]');
  });

  it('should sanitize SQL SELECT fragments', () => {
    const msg = 'Error in query: SELECT users.email FROM users WHERE id = 1';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('SELECT users.email');
    expect(result).toContain('[sql-redacted]');
  });

  it('should sanitize SQL INSERT fragments', () => {
    const msg = 'Failed: INSERT INTO payments (amount, card)';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('INSERT INTO payments');
    expect(result).toContain('[sql-redacted]');
  });

  it('should sanitize SQL UPDATE fragments', () => {
    const msg = 'Error executing UPDATE users SET password = $1';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('UPDATE users');
    expect(result).toContain('[sql-redacted]');
  });

  it('should sanitize SQL DELETE fragments', () => {
    const msg = 'Cannot DELETE FROM sessions WHERE expired = true';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('DELETE FROM sessions');
    expect(result).toContain('[sql-redacted]');
  });

  it('should sanitize SQL JOIN fragments', () => {
    const msg = 'Error in JOIN users ON users.id = orders.user_id';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('JOIN users');
    expect(result).toContain('[sql-redacted]');
  });

  it('should remove stack trace lines', () => {
    const msg =
      'TypeError: Cannot read property\n    at Function.handle (/app/router.js:10)\n    at Object.next (/app/middleware.js:5)';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('at Function.handle');
    expect(result).not.toContain('at Object.next');
  });

  it('should remove framework version numbers', () => {
    const msg = 'Error in Express/4.18.2 running on Node/18.17.0';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('Express/4.18.2');
    expect(result).not.toContain('Node/18.17.0');
    expect(result).toContain('[version-redacted]');
  });

  it('should remove connection strings', () => {
    const msg = 'Cannot connect to postgresql://admin:secret@10.0.0.1:5432/mydb';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('postgresql://');
    expect(result).not.toContain('admin:secret');
    expect(result).toContain('[connection-redacted]');
  });

  it('should handle null/undefined/empty input gracefully', () => {
    expect(sanitizeErrorMessage('')).toBe('An error occurred');
    expect(sanitizeErrorMessage(null as any)).toBe('An error occurred');
    expect(sanitizeErrorMessage(undefined as any)).toBe('An error occurred');
  });

  it('should not alter safe messages', () => {
    const msg = 'User not found';
    expect(sanitizeErrorMessage(msg)).toBe('User not found');
  });

  it('should handle multiple sensitive patterns in one message', () => {
    const msg =
      'Error at /home/user/app.ts: SELECT * FROM users failed on 192.168.1.1 with Express/4.18.2';
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain('/home/user');
    expect(result).not.toContain('SELECT *');
    expect(result).not.toContain('192.168.1.1');
    expect(result).not.toContain('Express/4.18.2');
  });
});

// ─── sanitizeErrorForProduction ──────────────────────────────────────

describe('sanitizeErrorForProduction', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should return generic message in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('column "password_hash" does not exist');
    const result = sanitizeErrorForProduction(error);
    expect(result.message).toBe('Internal server error');
    expect(result.code).toBe('INTERNAL_ERROR');
  });

  it('should preserve full details in development', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('column "password_hash" does not exist');
    const result = sanitizeErrorForProduction(error);
    expect(result.message).toBe('column "password_hash" does not exist');
  });

  it('should use error code when available in development', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('unique violation') as Error & { code: string };
    error.code = '23505';
    const result = sanitizeErrorForProduction(error);
    expect(result.code).toBe('23505');
  });

  it('should always return INTERNAL_ERROR code in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('test') as Error & { code: string };
    error.code = '23505';
    const result = sanitizeErrorForProduction(error);
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});

// ─── stripSensitiveHeaders ──────────────────────────────────────────

describe('stripSensitiveHeaders', () => {
  it('should redact Authorization header', () => {
    const headers = { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' };
    const result = stripSensitiveHeaders(headers);
    expect(result['Authorization']).toBe('[redacted]');
    expect(result['Content-Type']).toBe('application/json');
  });

  it('should redact Cookie header', () => {
    const headers = { Cookie: 'session=abc123', Accept: 'text/html' };
    const result = stripSensitiveHeaders(headers);
    expect(result['Cookie']).toBe('[redacted]');
    expect(result['Accept']).toBe('text/html');
  });

  it('should redact X-CSRF-Token header', () => {
    const headers = { 'X-CSRF-Token': 'csrf-secret-value' };
    const result = stripSensitiveHeaders(headers);
    expect(result['X-CSRF-Token']).toBe('[redacted]');
  });

  it('should be case-insensitive for header names', () => {
    const headers = { authorization: 'Bearer token', cookie: 'sid=xyz' };
    const result = stripSensitiveHeaders(headers);
    expect(result['authorization']).toBe('[redacted]');
    expect(result['cookie']).toBe('[redacted]');
  });

  it('should handle null/undefined input', () => {
    expect(stripSensitiveHeaders(null as any)).toEqual({});
    expect(stripSensitiveHeaders(undefined as any)).toEqual({});
  });

  it('should preserve non-sensitive headers', () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/html',
      'X-Request-Id': 'req-123',
    };
    const result = stripSensitiveHeaders(headers);
    expect(result).toEqual(headers);
  });
});

// ─── globalErrorHandler integration ─────────────────────────────────

describe('globalErrorHandler with sanitization', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should return generic 500 message in production for unhandled errors', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('SELECT * FROM users WHERE id = 1 at /home/user/app.ts');
    const req = createMockReq({ path: '/api/test', method: 'GET' });
    const res = createMockRes();
    const next = createMockNext();

    globalErrorHandler(err, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.message).toBe('Internal server error');
    expect(jsonCall.code).toBe('INTERNAL_ERROR');
    // Must not leak SQL or file paths
    expect(jsonCall.message).not.toContain('SELECT');
    expect(jsonCall.message).not.toContain('/home/');
  });

  it('should sanitize error messages in development for non-5xx', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Cannot find record in table "secret_users"') as any;
    err.status = 404;
    const req = createMockReq({ path: '/api/test', method: 'GET' });
    const res = createMockRes();
    const next = createMockNext();

    globalErrorHandler(err, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const jsonCall = (res.json as any).mock.calls[0][0];
    // In dev mode, non-5xx errors get sanitized via sanitizeErrorMessage
    expect(jsonCall.message).not.toContain('"secret_users"');
  });

  it('should produce consistent 404 response format', () => {
    process.env.NODE_ENV = 'production';
    const err = new AppError('Resource not found', 404, 'NOT_FOUND');
    const req = createMockReq({ path: '/api/nonexistent', method: 'GET' });
    const res = createMockRes();
    const next = createMockNext();

    globalErrorHandler(err, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall).toHaveProperty('message');
    expect(jsonCall).toHaveProperty('code', 'NOT_FOUND');
    expect(jsonCall).toHaveProperty('requestId');
  });

  it('should sanitize AppError messages with SQL in production 5xx', () => {
    process.env.NODE_ENV = 'production';
    const err = new AppError(
      'Failed: INSERT INTO payments (amount) at /server/routes.ts',
      500,
      'DB_ERROR',
    );
    const req = createMockReq({ path: '/api/test', method: 'POST' });
    const res = createMockRes();
    const next = createMockNext();

    globalErrorHandler(err, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.message).toBe('Internal server error');
    expect(jsonCall.message).not.toContain('INSERT INTO');
    expect(jsonCall.message).not.toContain('/server/');
  });

  it('should not strip details from 4xx AppErrors', () => {
    process.env.NODE_ENV = 'production';
    const err = new AppError('Invalid email', 400, 'VALIDATION_ERROR', {
      field: 'email',
    });
    const req = createMockReq({ path: '/api/test', method: 'POST' });
    const res = createMockRes();
    const next = createMockNext();

    globalErrorHandler(err, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.details).toEqual({ field: 'email' });
  });
});
