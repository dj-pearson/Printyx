/**
 * SEC-009: Data Exfiltration Prevention Middleware
 *
 * Tracks per-user cumulative response sizes and record counts within
 * a sliding 10-minute window. Warns and eventually blocks requests
 * that exceed configured thresholds, preventing bulk data extraction.
 *
 * Thresholds (per 10-minute window):
 *   - Warn  at 10 MB cumulative response data
 *   - Block at 50 MB cumulative response data
 *   - Warn  at 1,000 records returned
 *   - Block at 5,000 records returned
 */

import type { Request, Response, NextFunction } from 'express';
import { getUserId, getTenantId } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('exfiltration-guard');

// ── Thresholds ──────────────────────────────────────────────────────────────

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const SIZE_WARN_BYTES = 10 * 1024 * 1024;  // 10 MB
const SIZE_BLOCK_BYTES = 50 * 1024 * 1024;  // 50 MB

const RECORD_WARN_COUNT = 1_000;
const RECORD_BLOCK_COUNT = 5_000;

// ── Per-user tracking state ─────────────────────────────────────────────────

interface WindowEntry {
  /** Timestamp when this window started */
  windowStart: number;
  /** Cumulative response bytes in current window */
  totalBytes: number;
  /** Cumulative record count in current window */
  totalRecords: number;
  /** Whether the user is currently blocked */
  blocked: boolean;
}

/** In-memory map keyed by userId (or IP fallback) */
const trackingMap = new Map<string, WindowEntry>();

/** Security alerts for admin review */
interface ExfiltrationAlert {
  timestamp: Date;
  userId: string;
  tenantId: string | undefined;
  type: 'SIZE_WARNING' | 'SIZE_BLOCK' | 'RECORD_WARNING' | 'RECORD_BLOCK';
  currentValue: number;
  threshold: number;
  path: string;
  ip: string;
}

const alerts: ExfiltrationAlert[] = [];
const MAX_ALERTS = 1_000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getUserKey(req: Request): string {
  return getUserId(req) || req.ip || 'unknown';
}

function getOrCreateEntry(key: string, now: number): WindowEntry {
  let entry = trackingMap.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // Start a new window
    entry = {
      windowStart: now,
      totalBytes: 0,
      totalRecords: 0,
      blocked: false,
    };
    trackingMap.set(key, entry);
  }

  return entry;
}

function pushAlert(alert: ExfiltrationAlert): void {
  alerts.push(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts.splice(0, alerts.length - MAX_ALERTS);
  }
}

function extractRecordCount(body: unknown): number {
  if (body && typeof body === 'object' && 'data' in body) {
    const data = (body as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      return data.length;
    }
  }
  return 0;
}

// ── Cleanup stale entries periodically ──────────────────────────────────────

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of trackingMap) {
    if (now - entry.windowStart >= WINDOW_MS) {
      trackingMap.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Allow the process to exit cleanly
if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
  cleanupTimer.unref();
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function exfiltrationGuard(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const userKey = getUserKey(req);
  const entry = getOrCreateEntry(userKey, now);

  // If user is already blocked in this window, reject immediately
  if (entry.blocked) {
    log.warn(
      {
        userId: userKey,
        path: req.path,
        securityEvent: 'EXFILTRATION_BLOCKED',
      },
      'Request blocked: user exceeded exfiltration threshold in current window',
    );
    res.status(429).json({
      message: 'Too much data requested in a short period. Please try again later.',
      code: 'EXFILTRATION_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000),
    });
    return;
  }

  // Intercept the response to track size and record count
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const trackResponse = (body: unknown, isSend: boolean): Response => {
    // Calculate response size
    let responseSize = 0;
    const contentLength = res.getHeader('content-length');
    if (contentLength) {
      responseSize = typeof contentLength === 'string' ? parseInt(contentLength, 10) : (contentLength as number);
    } else if (body !== undefined && body !== null) {
      if (typeof body === 'string') {
        responseSize = Buffer.byteLength(body, 'utf8');
      } else if (Buffer.isBuffer(body)) {
        responseSize = body.length;
      } else {
        // For objects (json), estimate from serialized form
        try {
          responseSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
        } catch {
          responseSize = 0;
        }
      }
    }

    // Extract record count from JSON body
    const recordCount = extractRecordCount(body);

    // Update tracking
    entry.totalBytes += responseSize;
    entry.totalRecords += recordCount;

    const ip = req.ip || 'unknown';
    const tenantId = getTenantId(req);

    // Check size thresholds
    if (entry.totalBytes >= SIZE_BLOCK_BYTES) {
      entry.blocked = true;
      const alert: ExfiltrationAlert = {
        timestamp: new Date(),
        userId: userKey,
        tenantId,
        type: 'SIZE_BLOCK',
        currentValue: entry.totalBytes,
        threshold: SIZE_BLOCK_BYTES,
        path: req.path,
        ip,
      };
      pushAlert(alert);
      log.error(
        {
          userId: userKey,
          tenantId,
          totalBytes: entry.totalBytes,
          threshold: SIZE_BLOCK_BYTES,
          path: req.path,
          ip,
          securityEvent: 'EXFILTRATION_SIZE_BLOCK',
        },
        'SECURITY: User blocked for exceeding data size exfiltration threshold',
      );
    } else if (entry.totalBytes >= SIZE_WARN_BYTES) {
      const alert: ExfiltrationAlert = {
        timestamp: new Date(),
        userId: userKey,
        tenantId,
        type: 'SIZE_WARNING',
        currentValue: entry.totalBytes,
        threshold: SIZE_WARN_BYTES,
        path: req.path,
        ip,
      };
      pushAlert(alert);
      log.warn(
        {
          userId: userKey,
          tenantId,
          totalBytes: entry.totalBytes,
          threshold: SIZE_WARN_BYTES,
          path: req.path,
          ip,
          securityEvent: 'EXFILTRATION_SIZE_WARNING',
        },
        'SECURITY: User approaching data size exfiltration threshold',
      );
    }

    // Check record count thresholds
    if (entry.totalRecords >= RECORD_BLOCK_COUNT) {
      entry.blocked = true;
      const alert: ExfiltrationAlert = {
        timestamp: new Date(),
        userId: userKey,
        tenantId,
        type: 'RECORD_BLOCK',
        currentValue: entry.totalRecords,
        threshold: RECORD_BLOCK_COUNT,
        path: req.path,
        ip,
      };
      pushAlert(alert);
      log.error(
        {
          userId: userKey,
          tenantId,
          totalRecords: entry.totalRecords,
          threshold: RECORD_BLOCK_COUNT,
          path: req.path,
          ip,
          securityEvent: 'EXFILTRATION_RECORD_BLOCK',
        },
        'SECURITY: User blocked for exceeding record count exfiltration threshold',
      );
    } else if (entry.totalRecords >= RECORD_WARN_COUNT) {
      const alert: ExfiltrationAlert = {
        timestamp: new Date(),
        userId: userKey,
        tenantId,
        type: 'RECORD_WARNING',
        currentValue: entry.totalRecords,
        threshold: RECORD_WARN_COUNT,
        path: req.path,
        ip,
      };
      pushAlert(alert);
      log.warn(
        {
          userId: userKey,
          tenantId,
          totalRecords: entry.totalRecords,
          threshold: RECORD_WARN_COUNT,
          path: req.path,
          ip,
          securityEvent: 'EXFILTRATION_RECORD_WARNING',
        },
        'SECURITY: User approaching record count exfiltration threshold',
      );
    }

    // Call the original method
    if (isSend) {
      return originalSend(body);
    }
    return originalJson(body);
  };

  res.json = (body: unknown): Response => trackResponse(body, false);
  res.send = (body?: unknown): Response => trackResponse(body, true);

  next();
}

// ── Admin API ───────────────────────────────────────────────────────────────

/**
 * Returns recent exfiltration alerts for admin dashboards.
 */
export function getExfiltrationAlerts(): ExfiltrationAlert[] {
  return [...alerts];
}

// ── Test helpers (exported for unit tests) ──────────────────────────────────

export function _clearTrackingState(): void {
  trackingMap.clear();
  alerts.length = 0;
}

export function _getTrackingMap(): Map<string, WindowEntry> {
  return trackingMap;
}

export { WINDOW_MS, SIZE_WARN_BYTES, SIZE_BLOCK_BYTES, RECORD_WARN_COUNT, RECORD_BLOCK_COUNT };
