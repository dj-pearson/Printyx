/**
 * SEC-008: Behavioral Anomaly Detection and Automated Threat Scoring
 *
 * Tracks per-IP behavioral signals using an in-memory sliding window and
 * calculates a composite threat score (0-100) from weighted signals:
 *   - Request velocity (requests/sec)
 *   - Endpoint breadth (unique endpoints hit)
 *   - Error rate (4xx/5xx ratio)
 *   - Param mutation rate (same endpoint, changing params)
 *   - Sequential ID access patterns
 *   - Auth failure rate (401/403 ratio)
 */

import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('threat-detection');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default sliding window duration in milliseconds (5 minutes). */
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/** Cleanup interval – evict stale entries every 60 seconds. */
const CLEANUP_INTERVAL_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestRecord {
  timestamp: number;
  endpoint: string;
  statusCode: number;
  /** Stringified sorted params for mutation detection */
  paramKey: string;
}

interface IpTracker {
  records: RequestRecord[];
  /** Per-endpoint set of seen param keys for mutation detection */
  endpointParams: Map<string, Set<string>>;
  /** Ordered list of numeric IDs extracted from endpoint paths */
  numericIds: number[];
}

export interface ThreatSignals {
  requestVelocity: number;
  endpointBreadth: number;
  errorRate: number;
  paramMutationRate: number;
  sequentialIdAccess: boolean;
  authFailureRate: number;
}

export interface ThreatInfo {
  ip: string;
  score: number;
  signals: ThreatSignals;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const ipTrackers = new Map<string, IpTracker>();

let windowMs = DEFAULT_WINDOW_MS;

// Periodic cleanup of stale entries
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, tracker] of ipTrackers.entries()) {
      pruneRecords(tracker, now);
      if (tracker.records.length === 0) {
        ipTrackers.delete(ip);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit even if the timer is still running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureTracker(ip: string): IpTracker {
  let tracker = ipTrackers.get(ip);
  if (!tracker) {
    tracker = {
      records: [],
      endpointParams: new Map(),
      numericIds: [],
    };
    ipTrackers.set(ip, tracker);
    startCleanup();
  }
  return tracker;
}

function pruneRecords(tracker: IpTracker, now: number): void {
  const cutoff = now - windowMs;
  // Remove old records
  while (tracker.records.length > 0 && tracker.records[0].timestamp < cutoff) {
    tracker.records.shift();
  }
  // Also prune numeric IDs that are outside the window –
  // numericIds don't carry timestamps, so we keep only as many as records remain
  // (a rough heuristic; precise per-timestamp pruning isn't needed for scoring).
  if (tracker.records.length === 0) {
    tracker.numericIds = [];
    tracker.endpointParams.clear();
  }
}

/**
 * Normalise a params object to a stable string key for mutation detection.
 */
function paramsToKey(params: Record<string, unknown> | undefined): string {
  if (!params || Object.keys(params).length === 0) return '';
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&');
  return sorted;
}

/**
 * Extract numeric IDs from an endpoint path (e.g. /api/users/123 -> 123).
 */
function extractNumericIds(endpoint: string): number[] {
  const ids: number[] = [];
  const parts = endpoint.split('/');
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      ids.push(parseInt(part, 10));
    }
  }
  return ids;
}

/**
 * Detect sequential numeric ID access in the stored IDs.
 * Returns true if there are 3+ consecutive IDs that form an arithmetic
 * sequence with step 1 (ascending or descending).
 */
function detectSequentialIds(ids: number[]): boolean {
  if (ids.length < 3) return false;
  let consecutive = 1;
  for (let i = 1; i < ids.length; i++) {
    const diff = ids[i] - ids[i - 1];
    if (diff === 1 || diff === -1) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      consecutive = 1;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Signal calculation
// ---------------------------------------------------------------------------

function computeSignals(tracker: IpTracker, now: number): ThreatSignals {
  pruneRecords(tracker, now);
  const records = tracker.records;
  const total = records.length;

  if (total === 0) {
    return {
      requestVelocity: 0,
      endpointBreadth: 0,
      errorRate: 0,
      paramMutationRate: 0,
      sequentialIdAccess: false,
      authFailureRate: 0,
    };
  }

  // Request velocity (requests per second over the window)
  const windowSec = windowMs / 1000;
  const requestVelocity = total / windowSec;

  // Endpoint breadth
  const uniqueEndpoints = new Set(records.map((r) => r.endpoint));
  const endpointBreadth = uniqueEndpoints.size;

  // Error rate (4xx + 5xx)
  const errors = records.filter((r) => r.statusCode >= 400).length;
  const errorRate = errors / total;

  // Auth failure rate (401 + 403)
  const authFailures = records.filter(
    (r) => r.statusCode === 401 || r.statusCode === 403,
  ).length;
  const authFailureRate = authFailures / total;

  // Param mutation rate: for endpoints hit more than once, what fraction
  // have seen changing params?
  let mutatingEndpoints = 0;
  let multiHitEndpoints = 0;
  for (const [, paramSet] of tracker.endpointParams) {
    if (paramSet.size > 1) {
      multiHitEndpoints++;
      mutatingEndpoints++;
    } else if (paramSet.size === 1) {
      multiHitEndpoints++;
    }
  }
  const paramMutationRate =
    multiHitEndpoints > 0 ? mutatingEndpoints / multiHitEndpoints : 0;

  // Sequential ID access
  const sequentialIdAccess = detectSequentialIds(tracker.numericIds);

  return {
    requestVelocity,
    endpointBreadth,
    errorRate,
    paramMutationRate,
    sequentialIdAccess,
    authFailureRate,
  };
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function computeScore(signals: ThreatSignals): number {
  let score = 0;

  // Velocity > 10 req/s: +30
  if (signals.requestVelocity > 10) {
    score += 30;
  }

  // Breadth > 20 endpoints / window: +20
  if (signals.endpointBreadth > 20) {
    score += 20;
  }

  // Error rate > 0.5: +25
  if (signals.errorRate > 0.5) {
    score += 25;
  }

  // Sequential ID access detected: +25
  if (signals.sequentialIdAccess) {
    score += 25;
  }

  // Auth failure rate > 0.3: +20
  if (signals.authFailureRate > 0.3) {
    score += 20;
  }

  return Math.min(score, 100);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record an incoming request for the given IP.
 */
export function recordRequest(
  ip: string,
  endpoint: string,
  statusCode: number,
  params?: Record<string, unknown>,
): void {
  const now = Date.now();
  const tracker = ensureTracker(ip);

  const paramKey = paramsToKey(params);

  tracker.records.push({
    timestamp: now,
    endpoint,
    statusCode,
    paramKey,
  });

  // Track params per endpoint
  if (!tracker.endpointParams.has(endpoint)) {
    tracker.endpointParams.set(endpoint, new Set());
  }
  tracker.endpointParams.get(endpoint)!.add(paramKey);

  // Track numeric IDs
  const ids = extractNumericIds(endpoint);
  tracker.numericIds.push(...ids);
}

/**
 * Get the current threat score (0-100) and signals for an IP.
 */
export function getThreatScore(ip: string): ThreatInfo {
  const tracker = ipTrackers.get(ip);
  if (!tracker) {
    return {
      ip,
      score: 0,
      signals: {
        requestVelocity: 0,
        endpointBreadth: 0,
        errorRate: 0,
        paramMutationRate: 0,
        sequentialIdAccess: false,
        authFailureRate: 0,
      },
    };
  }

  const now = Date.now();
  const signals = computeSignals(tracker, now);
  const score = computeScore(signals);

  return { ip, score, signals };
}

/**
 * Return all IPs that currently have a non-zero threat score.
 */
export function getActiveThreats(): ThreatInfo[] {
  const threats: ThreatInfo[] = [];
  const now = Date.now();

  for (const [ip, tracker] of ipTrackers.entries()) {
    const signals = computeSignals(tracker, now);
    const score = computeScore(signals);
    if (score > 0) {
      threats.push({ ip, score, signals });
    }
  }

  return threats.sort((a, b) => b.score - a.score);
}

/**
 * Reset threat data for a specific IP (e.g. after CAPTCHA verification).
 */
export function resetThreatData(ip: string): void {
  ipTrackers.delete(ip);
  log.info({ ip }, 'Threat data reset for IP');
}

// ---------------------------------------------------------------------------
// Testing helpers
// ---------------------------------------------------------------------------

/**
 * Override the sliding window duration (for testing).
 */
export function _setWindowMs(ms: number): void {
  windowMs = ms;
}

/**
 * Get the current window duration (for testing).
 */
export function _getWindowMs(): number {
  return windowMs;
}

/**
 * Clear all tracking data (for testing).
 */
export function _clearAll(): void {
  ipTrackers.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  windowMs = DEFAULT_WINDOW_MS;
}
