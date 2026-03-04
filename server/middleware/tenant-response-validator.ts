/**
 * SEC-009: Tenant Response Validator Middleware
 *
 * Spot-checks a configurable percentage of API responses (default 5%)
 * to verify that no cross-tenant data leaks through. When a sampled
 * response contains records whose `tenantId` differs from the
 * authenticated user's tenant, a CRITICAL security alert is logged.
 */

import type { Request, Response, NextFunction } from 'express';
import { getTenantId } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('tenant-response-validator');

/** Percentage of responses to sample (0–100) */
const SAMPLE_RATE_PERCENT = 5;

// ── Helpers ─────────────────────────────────────────────────────────────────

function shouldSample(): boolean {
  return Math.random() * 100 < SAMPLE_RATE_PERCENT;
}

/**
 * Walk through a JSON body looking for objects with a `tenantId` field.
 * Returns the first mismatching tenantId found, or null if all match.
 */
function findCrossTenantLeak(body: unknown, expectedTenantId: string): string | null {
  if (body === null || body === undefined || typeof body !== 'object') {
    return null;
  }

  // Check arrays
  if (Array.isArray(body)) {
    for (const item of body) {
      const leak = findCrossTenantLeak(item, expectedTenantId);
      if (leak) return leak;
    }
    return null;
  }

  // Check object
  const obj = body as Record<string, unknown>;

  if ('tenantId' in obj && typeof obj.tenantId === 'string') {
    if (obj.tenantId !== expectedTenantId) {
      return obj.tenantId;
    }
  }

  // Check nested `data` array (common API envelope pattern)
  if ('data' in obj && Array.isArray(obj.data)) {
    for (const item of obj.data) {
      const leak = findCrossTenantLeak(item, expectedTenantId);
      if (leak) return leak;
    }
  }

  return null;
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function tenantResponseValidator(req: Request, res: Response, next: NextFunction): void {
  // Only sample a subset of responses
  if (!shouldSample()) {
    next();
    return;
  }

  const tenantId = getTenantId(req);

  // Cannot validate if there is no tenant context
  if (!tenantId) {
    next();
    return;
  }

  // Intercept res.json to inspect the body
  const originalJson = res.json.bind(res);

  res.json = (body: unknown): Response => {
    try {
      const leakedTenantId = findCrossTenantLeak(body, tenantId);

      if (leakedTenantId) {
        log.error(
          {
            expectedTenantId: tenantId,
            leakedTenantId,
            path: req.path,
            method: req.method,
            securityEvent: 'CROSS_TENANT_DATA_LEAK',
            severity: 'CRITICAL',
          },
          'CRITICAL SECURITY: Cross-tenant data detected in API response',
        );
      }
    } catch (err) {
      // Never let validation errors break the response
      log.debug(
        { error: err instanceof Error ? err.message : String(err) },
        'Tenant response validation encountered an error',
      );
    }

    return originalJson(body);
  };

  next();
}

// ── Test helpers ────────────────────────────────────────────────────────────

export { findCrossTenantLeak, SAMPLE_RATE_PERCENT };
