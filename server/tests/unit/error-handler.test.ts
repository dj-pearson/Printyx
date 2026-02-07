/**
 * Unit Tests: Global Error Handler & API Error Classes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
} from '../../lib/api-errors';
import { globalErrorHandler } from '../../middleware/error-handler';
import { createMockReq, createMockRes, createMockNext } from '../helpers/test-utils';

// Mock the monitoring logger
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

describe('API Error Classes', () => {
  it('should create AppError with all fields', () => {
    const err = new AppError('test message', 418, 'TEAPOT', { detail: 'info' });
    expect(err.message).toBe('test message');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.details).toEqual({ detail: 'info' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('should create NotFoundError (404)', () => {
    const err = new NotFoundError('Customer');
    expect(err.message).toBe('Customer not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err).toBeInstanceOf(AppError);
  });

  it('should create ValidationError (400)', () => {
    const err = new ValidationError('Invalid email format', { field: 'email' });
    expect(err.message).toBe('Invalid email format');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('should create AuthenticationError (401)', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication required');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('should create AuthenticationError with custom message', () => {
    const err = new AuthenticationError('Token expired');
    expect(err.message).toBe('Token expired');
    expect(err.statusCode).toBe(401);
  });

  it('should create AuthorizationError (403)', () => {
    const err = new AuthorizationError();
    expect(err.message).toBe('Insufficient permissions');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('should create ConflictError (409)', () => {
    const err = new ConflictError('Email already registered', { email: 'a@b.com' });
    expect(err.message).toBe('Email already registered');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('should create RateLimitError (429)', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Rate limit exceeded');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should preserve prototype chain for instanceof checks', () => {
    const notFound = new NotFoundError('X');
    const validation = new ValidationError('X');
    const auth = new AuthenticationError();
    const authz = new AuthorizationError();
    const conflict = new ConflictError('X');
    const rateLimit = new RateLimitError();

    // All should be instances of both their class and AppError
    expect(notFound).toBeInstanceOf(NotFoundError);
    expect(notFound).toBeInstanceOf(AppError);
    expect(validation).toBeInstanceOf(ValidationError);
    expect(auth).toBeInstanceOf(AuthenticationError);
    expect(authz).toBeInstanceOf(AuthorizationError);
    expect(conflict).toBeInstanceOf(ConflictError);
    expect(rateLimit).toBeInstanceOf(RateLimitError);
  });
});

describe('Global Error Handler Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = createMockReq({ path: '/api/test', method: 'GET' });
    req.requestId = 'req-123';
    res = createMockRes();
    next = createMockNext();
  });

  it('should handle NotFoundError with 404', () => {
    const err = new NotFoundError('Customer');
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res._json).toEqual({
      message: 'Customer not found',
      code: 'NOT_FOUND',
      details: undefined,
      requestId: 'req-123',
    });
  });

  it('should handle ValidationError with 400', () => {
    const err = new ValidationError('Invalid email', { field: 'email' });
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json).toEqual({
      message: 'Invalid email',
      code: 'VALIDATION_ERROR',
      details: { field: 'email' },
      requestId: 'req-123',
    });
  });

  it('should handle AuthenticationError with 401', () => {
    const err = new AuthenticationError();
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.code).toBe('UNAUTHORIZED');
  });

  it('should handle AuthorizationError with 403', () => {
    const err = new AuthorizationError('Admin only');
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._json.message).toBe('Admin only');
    expect(res._json.code).toBe('FORBIDDEN');
  });

  it('should handle ConflictError with 409', () => {
    const err = new ConflictError('Duplicate entry');
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res._json.code).toBe('CONFLICT');
  });

  it('should handle RateLimitError with 429', () => {
    const err = new RateLimitError();
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res._json.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should handle ZodError as ValidationError', () => {
    const schema = z.object({ email: z.string().email() });
    let zodErr: z.ZodError | undefined;
    try {
      schema.parse({ email: 'not-an-email' });
    } catch (e) {
      zodErr = e as z.ZodError;
    }

    globalErrorHandler(zodErr!, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.code).toBe('VALIDATION_ERROR');
    expect(res._json.message).toBe('Validation failed');
    expect(res._json.details.errors).toBeDefined();
    expect(res._json.details.errors[0].path).toBe('email');
  });

  it('should handle generic Error as 500', () => {
    const err = new Error('Something broke');
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json.code).toBe('INTERNAL_ERROR');
    expect(res._json.requestId).toBe('req-123');
  });

  it('should sanitize 500 error messages in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Database connection string leaked');
    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json.message).toBe('Internal server error');

    process.env.NODE_ENV = originalEnv;
  });

  it('should show error message for 500 in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Detailed debug info');
    globalErrorHandler(err, req, res, next);

    expect(res._json.message).toBe('Detailed debug info');

    process.env.NODE_ENV = originalEnv;
  });

  it('should not send response if headers already sent', () => {
    res.headersSent = true;
    const err = new NotFoundError('X');
    globalErrorHandler(err, req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should include requestId in all responses', () => {
    req.requestId = 'unique-req-id';

    const err = new AuthenticationError();
    globalErrorHandler(err, req, res, next);

    expect(res._json.requestId).toBe('unique-req-id');
  });

  it('should handle missing requestId gracefully', () => {
    delete req.requestId;

    const err = new NotFoundError('Resource');
    globalErrorHandler(err, req, res, next);

    expect(res._json.requestId).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should use err.status for non-AppError errors with status field', () => {
    const err: any = new Error('Custom error');
    err.status = 422;

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });
});
