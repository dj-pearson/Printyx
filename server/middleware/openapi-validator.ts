/**
 * OpenAPI Schema Validation Middleware (SEC-006)
 *
 * Validates incoming request bodies against registered Zod schemas.
 * Features:
 * - Route-to-schema mapping for POST/PUT/PATCH body validation
 * - Rejects unknown additional properties for write operations
 * - Detects injection patterns (null bytes, control characters) in strings
 * - Max nesting depth enforcement to prevent resource exhaustion
 * - Gradual rollout: unvalidated routes log a warning but are not blocked
 * - Standardised 400 errors: { message, code: 'VALIDATION_ERROR', details }
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodObject, ZodRawShape } from 'zod';
import { createModuleLogger } from '../lib/logger';
import {
  businessRecordSchemas,
  dealSchemas,
  userSchemas,
  serviceTicketSchemas,
  apiKeyCreateSchema,
} from './enhanced-validation';

const log = createModuleLogger('openapi-validator');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum allowed nesting depth for request bodies. */
const MAX_NESTING_DEPTH = 10;

/** Maximum allowed body size (characters when serialised). */
const MAX_BODY_STRING_LENGTH = 1_000_000; // ~1 MB of JSON text

// ---------------------------------------------------------------------------
// Injection / control-character patterns
// ---------------------------------------------------------------------------

/**
 * Regex that matches dangerous byte sequences inside strings:
 *  - Null bytes  (\x00)
 *  - Most C0 control characters (except \t \n \r which are harmless)
 *  - DEL character (\x7F)
 *  - C1 control range (\x80-\x9F)
 */
const DANGEROUS_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/;

// ---------------------------------------------------------------------------
// Route → schema registry
// ---------------------------------------------------------------------------

export interface RouteSchemaEntry {
  /** HTTP method (lowercase). */
  method: 'post' | 'put' | 'patch';
  /**
   * Express-style path pattern.  We convert `:param` segments to a wildcard
   * for matching purposes.
   */
  path: string;
  /** Zod schema the body must satisfy. */
  schema: ZodSchema;
}

/**
 * Default route-schema registry built from existing enhanced-validation schemas.
 * Additional entries can be registered at runtime via `registerRouteSchema`.
 */
const routeSchemaRegistry: RouteSchemaEntry[] = [
  // Business records (leads / customers)
  { method: 'post', path: '/api/business-records', schema: businessRecordSchemas.create },
  { method: 'put', path: '/api/business-records/:id', schema: businessRecordSchemas.update },
  { method: 'patch', path: '/api/business-records/:id', schema: businessRecordSchemas.update },

  // Deals
  { method: 'post', path: '/api/deals', schema: dealSchemas.create },
  { method: 'put', path: '/api/deals/:id', schema: dealSchemas.update },
  { method: 'patch', path: '/api/deals/:id', schema: dealSchemas.update },

  // Users
  { method: 'post', path: '/api/users', schema: userSchemas.create },
  { method: 'put', path: '/api/users/:id', schema: userSchemas.update },
  { method: 'patch', path: '/api/users/:id', schema: userSchemas.update },

  // Service tickets
  { method: 'post', path: '/api/service-tickets', schema: serviceTicketSchemas.create },
  { method: 'put', path: '/api/service-tickets/:id', schema: serviceTicketSchemas.update },
  { method: 'patch', path: '/api/service-tickets/:id', schema: serviceTicketSchemas.update },

  // API keys
  { method: 'post', path: '/api/api-keys', schema: apiKeyCreateSchema },
];

/**
 * Register an additional route schema at runtime.
 */
export function registerRouteSchema(entry: RouteSchemaEntry): void {
  routeSchemaRegistry.push(entry);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert an Express path pattern to a RegExp for matching. */
function pathToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape regex specials
    .replace(/\\:(\w+)/g, '[^/]+'); // replace :param with wildcard
  return new RegExp(`^${escaped}$`);
}

/** Look up a registered schema for the given method + path. */
function findSchemaForRoute(
  method: string,
  path: string,
): ZodSchema | undefined {
  const lowerMethod = method.toLowerCase();
  for (const entry of routeSchemaRegistry) {
    if (entry.method !== lowerMethod) continue;
    if (pathToRegex(entry.path).test(path)) {
      return entry.schema;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Depth check
// ---------------------------------------------------------------------------

/**
 * Recursively check nesting depth of an object / array.
 * Returns `true` when the depth exceeds `maxDepth`.
 */
export function exceedsMaxDepth(
  value: unknown,
  maxDepth: number = MAX_NESTING_DEPTH,
  currentDepth: number = 0,
): boolean {
  if (currentDepth > maxDepth) return true;
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((item) => exceedsMaxDepth(item, maxDepth, currentDepth + 1));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) =>
      exceedsMaxDepth(v, maxDepth, currentDepth + 1),
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// String scanning
// ---------------------------------------------------------------------------

/**
 * Recursively scan all string values in the payload for dangerous characters.
 * Returns an array of dot-paths where violations were found.
 */
export function findDangerousStrings(
  value: unknown,
  path: string = '',
): string[] {
  const violations: string[] = [];

  if (typeof value === 'string') {
    if (DANGEROUS_CHAR_RE.test(value)) {
      violations.push(path || 'body');
    }
    return violations;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      violations.push(...findDangerousStrings(item, `${path}[${index}]`));
    });
    return violations;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      violations.push(...findDangerousStrings(val, childPath));
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Unknown-property detection
// ---------------------------------------------------------------------------

/**
 * Given a ZodObject, return the set of top-level known keys.
 * For non-ZodObject schemas we return `null` to indicate "cannot check".
 */
function knownKeysFromSchema(schema: ZodSchema): Set<string> | null {
  // Unwrap ZodEffects (transforms / refines) to reach the inner ZodObject
  let inner: ZodSchema = schema;

  // Walk through ZodEffects layers
  while ((inner as { _def?: { schema?: ZodSchema } })._def?.schema) {
    inner = (inner as { _def: { schema: ZodSchema } })._def.schema;
  }

  if (inner instanceof ZodObject) {
    return new Set(Object.keys((inner as ZodObject<ZodRawShape>).shape));
  }
  return null;
}

/**
 * Detect unknown top-level properties relative to a schema.
 */
export function findUnknownProperties(
  body: Record<string, unknown>,
  schema: ZodSchema,
): string[] {
  const known = knownKeysFromSchema(schema);
  if (!known) return []; // can't determine – skip check
  return Object.keys(body).filter((k) => !known.has(k));
}

// ---------------------------------------------------------------------------
// Error formatter
// ---------------------------------------------------------------------------

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

function formatValidationResponse(
  res: Response,
  message: string,
  details: ValidationErrorDetail[],
  requestId?: string,
): void {
  res.status(400).json({
    message,
    code: 'VALIDATION_ERROR',
    details,
    ...(requestId ? { requestId } : {}),
  });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that validates incoming request bodies against
 * the route-schema registry.
 *
 * For routes with no registered schema the request is allowed through
 * (gradual rollout) but a warning is logged.
 */
export function openapiValidator() {
  return (req: Request & { requestId?: string }, res: Response, next: NextFunction): void => {
    const method = req.method.toLowerCase();

    // Only validate write operations
    if (!['post', 'put', 'patch'].includes(method)) {
      next();
      return;
    }

    const body = req.body;

    // 1. Oversized body check (serialised length)
    try {
      const serialised = JSON.stringify(body);
      if (serialised && serialised.length > MAX_BODY_STRING_LENGTH) {
        formatValidationResponse(res, 'Request body too large', [
          { field: 'body', message: `Body exceeds maximum size of ${MAX_BODY_STRING_LENGTH} characters`, code: 'too_big' },
        ], req.requestId);
        return;
      }
    } catch {
      // If body can't be serialised, let downstream handlers deal with it
    }

    // 2. Max nesting depth
    if (exceedsMaxDepth(body)) {
      formatValidationResponse(res, 'Request body nested too deeply', [
        { field: 'body', message: `Object nesting exceeds maximum depth of ${MAX_NESTING_DEPTH}`, code: 'too_deep' },
      ], req.requestId);
      return;
    }

    // 3. Dangerous characters in strings
    const dangerousFields = findDangerousStrings(body);
    if (dangerousFields.length > 0) {
      formatValidationResponse(
        res,
        'Request contains invalid characters',
        dangerousFields.map((field) => ({
          field,
          message: 'Contains null bytes or control characters',
          code: 'invalid_string',
        })),
        req.requestId,
      );
      return;
    }

    // 4. Route-specific schema validation
    // Strip versioning prefix for matching (e.g. /api/v1/deals -> /api/deals)
    const normalisedPath = req.path.replace(/^\/api\/v\d+\//, '/api/');
    const schema = findSchemaForRoute(method, normalisedPath);

    if (!schema) {
      // Gradual rollout – allow through but log
      log.warn(
        { method: req.method, path: req.path },
        `No validation schema registered for ${req.method} ${req.path}`,
      );
      next();
      return;
    }

    // 4a. Check for unknown properties (strict mode for write ops)
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const unknown = findUnknownProperties(body as Record<string, unknown>, schema);
      if (unknown.length > 0) {
        formatValidationResponse(
          res,
          'Unknown properties in request body',
          unknown.map((prop) => ({
            field: prop,
            message: `Unknown property: ${prop}`,
            code: 'unrecognized_keys',
          })),
          req.requestId,
        );
        return;
      }
    }

    // 4b. Validate body against schema
    const result = schema.safeParse(body);
    if (!result.success) {
      const zodError = result.error as ZodError;
      formatValidationResponse(
        res,
        'Validation failed',
        zodError.errors.map((e) => ({
          field: e.path.join('.') || 'body',
          message: e.message,
          code: e.code,
        })),
        req.requestId,
      );
      return;
    }

    // Replace body with parsed (and potentially transformed) data
    req.body = result.data;
    next();
  };
}

export default openapiValidator;
