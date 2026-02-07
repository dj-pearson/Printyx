/**
 * Error Sanitization Utility
 *
 * Prevents sensitive information disclosure in API error responses
 * SECURITY: Production errors should be generic, detailed errors only in development
 */

import { Response } from 'express';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('error-sanitizer');

interface SanitizedError {
  message: string;
  requestId?: string;
  details?: any;
}

/**
 * Sanitize error messages for production environments
 * Removes stack traces, internal paths, and sensitive details
 */
export function sanitizeError(error: any, isDevelopment: boolean = false): SanitizedError {
  // In development, return more details
  if (isDevelopment || process.env.NODE_ENV === 'development') {
    return {
      message: error?.message || 'An error occurred',
      details: error?.stack || error,
    };
  }

  // In production, return generic messages
  const sanitized: SanitizedError = {
    message: 'An error occurred processing your request',
  };

  // Map specific error types to user-friendly messages
  if (error?.code === 'ECONNREFUSED') {
    sanitized.message = 'Service temporarily unavailable';
  } else if (error?.code === '23505') {
    // PostgreSQL unique violation
    sanitized.message = 'This record already exists';
  } else if (error?.code === '23503') {
    // PostgreSQL foreign key violation
    sanitized.message = 'Cannot delete: record is referenced elsewhere';
  } else if (error?.code === 'ETIMEDOUT') {
    sanitized.message = 'Request timed out';
  } else if (error?.name === 'ValidationError') {
    sanitized.message = 'Invalid input data';
  } else if (error?.name === 'UnauthorizedError') {
    sanitized.message = 'Unauthorized access';
  }

  return sanitized;
}

/**
 * Send a sanitized error response
 * SECURITY: Automatically sanitizes errors in production
 */
export function sendErrorResponse(
  res: Response,
  error: any,
  statusCode: number = 500,
  requestId?: string,
) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const sanitized = sanitizeError(error, isDevelopment);

  // Always log the full error server-side
  log.error('[ERROR]', {
    requestId,
    error: error?.message || error,
    stack: error?.stack,
    code: error?.code,
  });

  // Send sanitized response to client
  res.status(statusCode).json({
    error: sanitized.message,
    requestId: requestId || undefined,
    ...(isDevelopment && sanitized.details ? { details: sanitized.details } : {}),
  });
}

/**
 * Sanitize sensitive data before logging
 * Removes passwords, tokens, credit cards, SSNs, etc.
 */
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'refreshToken',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
    'taxId',
    'bankAccount',
    'routingNumber',
  ];

  const cloned = Array.isArray(data) ? [...data] : { ...data };

  for (const key in cloned) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      cloned[key] = '[REDACTED]';
    } else if (typeof cloned[key] === 'object' && cloned[key] !== null) {
      cloned[key] = sanitizeForLogging(cloned[key]);
    }
  }

  return cloned;
}

/**
 * Middleware to add request ID to all requests
 */
export function requestIdMiddleware(req: any, res: any, next: any) {
  req.requestId =
    req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
