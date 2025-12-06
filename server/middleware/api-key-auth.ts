/**
 * API Key Authentication Middleware
 *
 * Middleware for authenticating requests using API keys.
 * Supports both header-based and query parameter authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService, ApiKeyValidationResult, RateLimitResult } from '../services/api-key-service';
import { randomBytes } from 'crypto';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        tenantId: string;
        keyType: string;
        scopes: string[];
        permissions: string[];
      };
      requestId?: string;
    }
  }
}

// Header names for API key
const API_KEY_HEADER = 'x-api-key';
const AUTHORIZATION_HEADER = 'authorization';
const API_KEY_QUERY_PARAM = 'api_key';

// Rate limit headers
const RATE_LIMIT_HEADERS = {
  limit: 'X-RateLimit-Limit',
  remaining: 'X-RateLimit-Remaining',
  reset: 'X-RateLimit-Reset',
};

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  // Check X-API-Key header first
  const headerKey = req.headers[API_KEY_HEADER] as string;
  if (headerKey) {
    return headerKey;
  }

  // Check Authorization header (Bearer token style)
  const authHeader = req.headers[AUTHORIZATION_HEADER] as string;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      // Check if it looks like an API key (starts with pk_)
      if (parts[1].startsWith('pk_')) {
        return parts[1];
      }
    }
  }

  // Check query parameter (less secure, use only for webhooks/callbacks)
  const queryKey = req.query[API_KEY_QUERY_PARAM] as string;
  if (queryKey) {
    return queryKey;
  }

  return null;
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(res: Response, rateLimit: RateLimitResult): void {
  // Use the most restrictive remaining count
  const remaining = Math.min(
    rateLimit.remaining.minute,
    rateLimit.remaining.hour,
    rateLimit.remaining.day
  );

  // Use the nearest reset time
  const resetTimes = [
    rateLimit.resetAt.minute,
    rateLimit.resetAt.hour,
    rateLimit.resetAt.day,
  ];
  const nearestReset = resetTimes.reduce((a, b) => (a < b ? a : b));

  res.setHeader(RATE_LIMIT_HEADERS.remaining, remaining.toString());
  res.setHeader(
    RATE_LIMIT_HEADERS.reset,
    Math.floor(nearestReset.getTime() / 1000).toString()
  );
}

/**
 * API Key Authentication Middleware
 *
 * Validates API key and attaches key info to request.
 * Does not enforce rate limits (use withRateLimit for that).
 */
export function requireApiKey(
  options: {
    requiredScopes?: string[];
    requiredPermissions?: string[];
    optional?: boolean;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Generate request ID for tracking
    req.requestId = randomBytes(8).toString('hex');
    res.setHeader('X-Request-Id', req.requestId);

    const apiKey = extractApiKey(req);

    // If no API key and auth is optional, continue
    if (!apiKey && options.optional) {
      return next();
    }

    // If no API key and auth is required, return error
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Provide an API key via X-API-Key header, Authorization: Bearer header, or api_key query parameter',
      });
    }

    // Validate the API key
    const validation = await apiKeyService.validateApiKey(apiKey, req.ip);

    if (!validation.valid) {
      const statusCode = validation.errorCode === 'RATE_LIMITED' ? 429 :
                        validation.errorCode === 'EXPIRED' ? 401 :
                        validation.errorCode === 'REVOKED' ? 401 :
                        validation.errorCode === 'INACTIVE' ? 401 :
                        validation.errorCode === 'IP_RESTRICTED' ? 403 : 401;

      return res.status(statusCode).json({
        error: validation.error,
        code: validation.errorCode,
      });
    }

    const key = validation.apiKey!;

    // Check required scopes
    if (options.requiredScopes && options.requiredScopes.length > 0) {
      const keyScopes = (key.scopes as string[]) || [];
      const hasAllScopes = options.requiredScopes.every(scope =>
        keyScopes.includes(scope) || keyScopes.includes('*')
      );

      if (!hasAllScopes) {
        return res.status(403).json({
          error: 'Insufficient scopes',
          required: options.requiredScopes,
          available: keyScopes,
        });
      }
    }

    // Check required permissions
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const keyPermissions = (key.permissions as string[]) || [];
      const hasAllPermissions = options.requiredPermissions.every(perm =>
        keyPermissions.includes(perm) || keyPermissions.includes('*')
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: options.requiredPermissions,
          available: keyPermissions,
        });
      }
    }

    // Attach API key info to request
    req.apiKey = {
      id: key.id,
      tenantId: key.tenantId,
      keyType: key.keyType,
      scopes: (key.scopes as string[]) || [],
      permissions: (key.permissions as string[]) || [],
    };

    // Set tenant context from API key
    (req as any).tenantId = key.tenantId;

    next();
  };
}

/**
 * Rate Limit Middleware
 *
 * Enforces rate limits for API key authenticated requests.
 * Must be used after requireApiKey middleware.
 */
export function withRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      // No API key, skip rate limiting
      return next();
    }

    const rateLimit = await apiKeyService.checkRateLimit(req.apiKey.id);

    setRateLimitHeaders(res, rateLimit);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      });
    }

    next();
  };
}

/**
 * API Key Usage Logging Middleware
 *
 * Logs API key usage after response is sent.
 * Must be used after requireApiKey middleware.
 */
export function logApiKeyUsage() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture response
    const originalEnd = res.end.bind(res);

    res.end = function (chunk?: any, encoding?: any, callback?: any) {
      // Log usage after response
      if (req.apiKey) {
        const responseTimeMs = Date.now() - startTime;

        apiKeyService.logUsage(
          req.apiKey.id,
          req.apiKey.tenantId,
          {
            requestId: req.requestId || '',
            method: req.method,
            path: req.path,
            queryParams: req.query,
            clientIp: req.ip,
            userAgent: req.headers['user-agent'],
            origin: req.headers['origin'] as string,
          },
          {
            statusCode: res.statusCode,
            responseTimeMs,
            errorMessage: res.statusCode >= 400 ? chunk?.toString() : undefined,
          }
        ).catch(err => {
          console.error('[API Key Usage] Failed to log usage:', err);
        });
      }

      return originalEnd(chunk, encoding, callback);
    } as any;

    next();
  };
}

/**
 * Scope checking helper
 */
export function hasScope(req: Request, scope: string): boolean {
  if (!req.apiKey) return false;
  const scopes = req.apiKey.scopes;
  return scopes.includes(scope) || scopes.includes('*');
}

/**
 * Permission checking helper
 */
export function hasPermission(req: Request, permission: string): boolean {
  if (!req.apiKey) return false;
  const permissions = req.apiKey.permissions;
  return permissions.includes(permission) || permissions.includes('*');
}

/**
 * Require specific scopes for a route
 */
export function requireScopes(...scopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const hasAllScopes = scopes.every(scope => hasScope(req, scope));

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'Insufficient scopes',
        required: scopes,
        available: req.apiKey.scopes,
      });
    }

    next();
  };
}

/**
 * Require specific permissions for a route
 */
export function requirePermissions(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const hasAllPermissions = permissions.every(perm => hasPermission(req, perm));

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        available: req.apiKey.permissions,
      });
    }

    next();
  };
}

/**
 * Combined middleware for API key auth with rate limiting and logging
 */
export function apiKeyAuth(
  options: {
    requiredScopes?: string[];
    requiredPermissions?: string[];
    rateLimit?: boolean;
    logUsage?: boolean;
  } = {}
) {
  const middlewares = [
    requireApiKey({
      requiredScopes: options.requiredScopes,
      requiredPermissions: options.requiredPermissions,
    }),
  ];

  if (options.rateLimit !== false) {
    middlewares.push(withRateLimit());
  }

  if (options.logUsage !== false) {
    middlewares.push(logApiKeyUsage());
  }

  return middlewares;
}

/**
 * Allow both session and API key authentication
 *
 * Tries API key first, then falls back to session auth.
 */
export function hybridAuth(options: { requiredScopes?: string[] } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = extractApiKey(req);

    // If API key is provided, validate it
    if (apiKey) {
      const validation = await apiKeyService.validateApiKey(apiKey, req.ip);

      if (validation.valid) {
        const key = validation.apiKey!;

        // Check scopes
        if (options.requiredScopes && options.requiredScopes.length > 0) {
          const keyScopes = (key.scopes as string[]) || [];
          const hasAllScopes = options.requiredScopes.every(scope =>
            keyScopes.includes(scope) || keyScopes.includes('*')
          );

          if (!hasAllScopes) {
            return res.status(403).json({
              error: 'Insufficient scopes',
              required: options.requiredScopes,
              available: keyScopes,
            });
          }
        }

        req.apiKey = {
          id: key.id,
          tenantId: key.tenantId,
          keyType: key.keyType,
          scopes: (key.scopes as string[]) || [],
          permissions: (key.permissions as string[]) || [],
        };
        (req as any).tenantId = key.tenantId;

        return next();
      }
    }

    // Fall back to session auth
    const session = req.session as any;
    if (session?.userId) {
      return next();
    }

    // No valid auth found
    res.status(401).json({
      error: 'Authentication required',
      message: 'Provide a valid API key or session cookie',
    });
  };
}
