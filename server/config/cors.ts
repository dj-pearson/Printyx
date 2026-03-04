/**
 * SEC-010: CORS Hardening and Origin Validation
 *
 * Environment-specific CORS configuration.
 * NEVER uses wildcard `*` origin in any environment.
 * Provides strict origin validation for all environments.
 */

import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('cors-config');

/** Structured CORS configuration for an environment */
export interface CorsConfig {
  /** Exact origin strings that are allowed */
  allowedOrigins: string[];
  /** RegExp patterns for dynamic origin matching */
  allowedPatterns: RegExp[];
  /** Whether credentials (cookies, auth headers) are allowed */
  credentials: boolean;
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Headers exposed to the client */
  exposedHeaders: string[];
  /** Preflight cache duration in seconds */
  maxAge: number;
  /** Whether to enforce Origin header on mutation requests (POST/PUT/PATCH/DELETE) */
  enforceMutationOrigin: boolean;
}

/** Development CORS origins */
const developmentOrigins: string[] = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
];

/** Development CORS patterns */
const developmentPatterns: RegExp[] = [
  /^https:\/\/.*\.replit\.dev$/,
];

/** Staging CORS origins */
const stagingOrigins: string[] = [
  'https://staging.printyx.net',
];

/** Production CORS origins */
const productionOrigins: string[] = [
  'https://printyx.net',
  'https://api.printyx.net',
];

/** Production CORS patterns - matches *.printyx.net subdomains */
const productionPatterns: RegExp[] = [
  /^https:\/\/([a-z0-9-]+\.)?printyx\.net$/,
];

/** Shared header configuration */
const sharedHeaders = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'x-tenant-id',
    'X-Demo-Auth',
  ],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400, // 24 hours
};

/**
 * Returns the CORS configuration for a given environment.
 *
 * @param env - The NODE_ENV value (development, staging, production, test)
 * @returns Complete CORS configuration for the environment
 */
export function getCorsConfig(env: string): CorsConfig {
  switch (env) {
    case 'development':
    case 'test':
      return {
        // Development: localhost + replit + production origins (for local testing against prod APIs)
        allowedOrigins: [...developmentOrigins, ...productionOrigins],
        allowedPatterns: [...developmentPatterns, ...productionPatterns],
        credentials: true,
        enforceMutationOrigin: false, // Relaxed in development
        ...sharedHeaders,
      };

    case 'staging':
      return {
        allowedOrigins: [...stagingOrigins],
        allowedPatterns: [],
        credentials: true,
        enforceMutationOrigin: true,
        ...sharedHeaders,
      };

    case 'production':
      return {
        allowedOrigins: [...productionOrigins],
        allowedPatterns: [...productionPatterns],
        credentials: true,
        enforceMutationOrigin: true,
        ...sharedHeaders,
      };

    default:
      log.warn({ env }, 'Unknown environment for CORS config, using production defaults');
      return {
        allowedOrigins: [...productionOrigins],
        allowedPatterns: [...productionPatterns],
        credentials: true,
        enforceMutationOrigin: true,
        ...sharedHeaders,
      };
  }
}

/**
 * Checks whether a given origin is allowed for the specified environment.
 * Never reflects arbitrary origins - only returns true for explicitly allowlisted origins.
 *
 * @param origin - The Origin header value to validate
 * @param env - The NODE_ENV value
 * @returns true if the origin is in the allowlist, false otherwise
 */
export function isAllowedOrigin(origin: string, env: string): boolean {
  // Never allow wildcard or empty origin
  if (!origin || origin === '*') {
    return false;
  }

  const corsConfig = getCorsConfig(env);

  // Check exact match first
  if (corsConfig.allowedOrigins.includes(origin)) {
    return true;
  }

  // Check patterns
  for (const pattern of corsConfig.allowedPatterns) {
    if (pattern.test(origin)) {
      return true;
    }
  }

  // Also check CORS_ADDITIONAL_ORIGINS from environment
  const additionalOrigins = process.env.CORS_ADDITIONAL_ORIGINS;
  if (additionalOrigins) {
    const extras = additionalOrigins.split(',').map((s) => s.trim()).filter(Boolean);
    if (extras.includes(origin)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the validated origin string if allowed, or false if not.
 * This is the safe function for setting Access-Control-Allow-Origin.
 * It never reflects an arbitrary origin - only returns the origin if it's explicitly allowed.
 *
 * @param origin - The Origin header value (may be undefined for same-origin/server requests)
 * @param env - The NODE_ENV value
 * @returns The origin string if allowed, false otherwise
 */
export function getValidatedOrigin(origin: string | undefined, env: string): string | false {
  if (!origin) {
    return false;
  }

  if (isAllowedOrigin(origin, env)) {
    return origin;
  }

  return false;
}

/**
 * Checks if the given HTTP method is a mutation method that requires Origin validation.
 */
export function isMutationMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}
