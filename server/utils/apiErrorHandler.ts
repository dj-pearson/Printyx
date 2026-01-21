/**
 * Standardized API error handling utilities
 * Provides consistent error responses across all API endpoints
 */

import { Response } from 'express';

export interface ApiError {
  success: false;
  message: string;
  error?: string;
  errorCode?: string;
  timestamp: string;
  details?: any;
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Error codes for common API errors
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'AUTH_001',
  FORBIDDEN: 'AUTH_002',
  INVALID_TOKEN: 'AUTH_003',
  SESSION_EXPIRED: 'AUTH_004',

  // Validation
  VALIDATION_ERROR: 'VAL_001',
  MISSING_REQUIRED_FIELD: 'VAL_002',
  INVALID_FORMAT: 'VAL_003',
  DUPLICATE_ENTRY: 'VAL_004',

  // Resource
  NOT_FOUND: 'RES_001',
  ALREADY_EXISTS: 'RES_002',
  CONFLICT: 'RES_003',

  // Database
  DATABASE_ERROR: 'DB_001',
  QUERY_FAILED: 'DB_002',
  CONNECTION_ERROR: 'DB_003',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXT_001',
  THIRD_PARTY_API_ERROR: 'EXT_002',
  INTEGRATION_ERROR: 'EXT_003',

  // Generic
  INTERNAL_SERVER_ERROR: 'SRV_001',
  BAD_REQUEST: 'REQ_001',
  RATE_LIMIT_EXCEEDED: 'REQ_002',
} as const;

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Main error handler - use this for all API error responses
 */
export function handleApiError(
  res: Response,
  error: unknown,
  context: string,
  statusCode: number = 500,
  errorCode?: string,
): Response<ApiError> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const finalErrorCode = errorCode || ErrorCodes.INTERNAL_SERVER_ERROR;
  const errorId = generateErrorId();

  // Log the error with context for debugging (keep console.error for server logs)
  console.error(`[${errorId}] [${finalErrorCode}] ${context}:`, {
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  return res.status(statusCode).json({
    success: false,
    message: `Failed to ${context}`,
    error: errorMessage,
    errorCode: finalErrorCode,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Success response helper
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
): Response<ApiSuccess<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Specific error handlers for common scenarios
 */
export const ApiErrorHandlers = {
  notFound: (res: Response, resource: string) =>
    handleApiError(
      res,
      new Error(`${resource} not found`),
      `find ${resource}`,
      404,
      ErrorCodes.NOT_FOUND,
    ),

  unauthorized: (res: Response, reason?: string) =>
    handleApiError(
      res,
      new Error(reason || 'Unauthorized access'),
      'authenticate request',
      401,
      ErrorCodes.UNAUTHORIZED,
    ),

  forbidden: (res: Response, reason?: string) =>
    handleApiError(
      res,
      new Error(reason || 'Access forbidden'),
      'authorize action',
      403,
      ErrorCodes.FORBIDDEN,
    ),

  validation: (res: Response, details: string) =>
    handleApiError(
      res,
      new Error(`Validation failed: ${details}`),
      'validate input',
      400,
      ErrorCodes.VALIDATION_ERROR,
    ),

  conflict: (res: Response, resource: string) =>
    handleApiError(
      res,
      new Error(`${resource} already exists or conflicts with existing data`),
      `create ${resource}`,
      409,
      ErrorCodes.CONFLICT,
    ),

  database: (res: Response, operation: string, error: unknown) =>
    handleApiError(
      res,
      error,
      `execute database operation: ${operation}`,
      500,
      ErrorCodes.DATABASE_ERROR,
    ),

  externalService: (res: Response, service: string, error: unknown) =>
    handleApiError(
      res,
      error,
      `communicate with ${service}`,
      502,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
    ),
};

/**
 * Error handling middleware wrapper
 * Wraps async route handlers to catch errors automatically
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleApiError(res, error, 'process request');
    });
  };
}

/**
 * Validate required fields helper
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[],
  res: Response,
): boolean {
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    ApiErrorHandlers.validation(res, `Missing required fields: ${missingFields.join(', ')}`);
    return false;
  }

  return true;
}
