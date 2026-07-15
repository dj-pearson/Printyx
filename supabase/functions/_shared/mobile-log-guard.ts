/**
 * CR-004: abuse-mitigation helpers for the (intentionally unauthenticated)
 * mobile-logs edge function. The function must keep working when app auth is
 * broken, so instead of a hard auth gate we bound the abuse surface that a
 * service-role log writer exposes:
 *   - per-request size caps (entry count, message/data length) -> no write-DoS
 *   - control-char / newline stripping -> no log injection into console output
 *   - best-effort in-memory fixed-window rate limiting per device/IP -> no flood
 *
 * All logic here is import-free and pure/injectable so it is unit-testable with
 * vitest (no Deno runtime needed).
 */

export const MAX_ENTRIES_PER_REQUEST = 100;
export const MAX_MESSAGE_LEN = 2000;
export const MAX_SCREEN_LEN = 200;
export const MAX_DATA_CHARS = 4000;
export const RATE_LIMIT_MAX = 60; // requests
export const RATE_LIMIT_WINDOW_MS = 60_000; // per minute per key

export interface RawLogEntry {
  level?: unknown;
  message?: unknown;
  screen?: unknown;
  data?: unknown;
  timestamp?: unknown;
}

export interface CleanLogEntry {
  level: string;
  message: string;
  screen: string | null;
  data: unknown | null;
  timestamp: unknown;
}

const ALLOWED_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'log']);

// ASCII control chars (incl. CR/LF/TAB) plus DEL — replaced so a crafted log
// message can't forge or split a console log line (log injection).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\x00-\x1F\x7F]', 'g');

/** Strip control characters, then truncate to `maxLen`. Non-strings become ''. */
export function sanitizeLogText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  const stripped = value.replace(CONTROL_CHARS, ' ');
  return stripped.length > maxLen ? stripped.slice(0, maxLen) : stripped;
}

/** Bound the serialized size of the structured `data` field. */
export function boundData(data: unknown): unknown | null {
  if (data === undefined || data === null) return null;
  try {
    const json = JSON.stringify(data);
    if (json.length > MAX_DATA_CHARS) {
      return { _truncated: true, preview: json.slice(0, MAX_DATA_CHARS) };
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Cap the batch to MAX_ENTRIES_PER_REQUEST and sanitize every field. Returns a
 * bounded, injection-safe list ready for console output and DB insert.
 */
export function capAndSanitizeEntries(entries: RawLogEntry[]): CleanLogEntry[] {
  return entries.slice(0, MAX_ENTRIES_PER_REQUEST).map((entry) => {
    const level =
      typeof entry.level === 'string' && ALLOWED_LEVELS.has(entry.level.toLowerCase())
        ? entry.level.toLowerCase()
        : 'info';
    return {
      level,
      message: sanitizeLogText(entry.message, MAX_MESSAGE_LEN),
      screen: entry.screen ? sanitizeLogText(entry.screen, MAX_SCREEN_LEN) : null,
      data: boundData(entry.data),
      timestamp: entry.timestamp ?? null,
    };
  });
}

/**
 * Best-effort in-memory fixed-window rate limiter. Edge instances are ephemeral
 * and may be replicated, so this is a first-line bound, not a global guarantee.
 */
export class FixedWindowRateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly max = RATE_LIMIT_MAX,
    private readonly windowMs = RATE_LIMIT_WINDOW_MS,
  ) {}

  /** Returns true if the request is allowed; false if the key is over the limit. */
  check(key: string, now: number): boolean {
    const entry = this.hits.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= this.max) return false;
    entry.count += 1;
    return true;
  }
}
