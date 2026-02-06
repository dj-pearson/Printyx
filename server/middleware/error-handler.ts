/**
 * Global Error Handler Middleware
 *
 * Catches errors thrown by route handlers and formats them as:
 * { message, code, details, requestId }
 *
 * - Recognizes AppError subclasses and uses their status/code
 * - Logs 5xx errors with full stack traces via createModuleLogger
 * - Sanitizes 5xx error messages in production (no stack traces to client)
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../lib/api-errors';
import { createModuleLogger } from '../lib/monitoring';
import { z } from 'zod';

const logger = createModuleLogger('error-handler');

export function globalErrorHandler(
  err: Error | AppError,
  req: Request & { requestId?: string },
  res: Response,
  _next: NextFunction,
): void {
  // Don't send a response if headers are already sent
  if (res.headersSent) {
    return;
  }

  const requestId = req.requestId;

  // Handle Zod validation errors as ValidationError
  if (err instanceof z.ZodError) {
    const details: Record<string, unknown> = {
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
    res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details,
      requestId,
    });
    return;
  }

  // Handle AppError subclasses
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, requestId, method: req.method, path: req.path, statusCode: err.statusCode },
        `Error ${err.statusCode}: ${err.message}`,
      );
    }

    res.status(err.statusCode).json({
      message: err.message,
      code: err.code,
      details: err.details,
      requestId,
    });
    return;
  }

  // Unhandled errors → 500
  const statusCode = (err as any).status || (err as any).statusCode || 500;

  logger.error(
    { err, requestId, method: req.method, path: req.path, statusCode },
    `Error ${statusCode}: ${err.message}`,
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && statusCode >= 500 ? 'Internal server error' : err.message;
  const code = (err as any).code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

  res.status(statusCode).json({
    message,
    code,
    details: (err as any).details,
    requestId,
  });
}
