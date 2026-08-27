/**
 * Mobile Logger - Client-side error and event logging
 *
 * Batches log entries and sends them to the mobile-logs edge function
 * for server-side visibility. Useful for debugging mobile app issues
 * where browser devtools aren't available.
 *
 * Usage:
 *   import { mobileLogger } from '@/lib/mobile-logger';
 *   mobileLogger.error('Page crash', { page: '/crm', error: err.message });
 *   mobileLogger.info('Navigation', { screen: '/dashboard' });
 */

import { config } from './config';

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  screen?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 50;

/**
 * CR-033: "is there a window?" is not the same question as "is this a browser".
 *
 * This module builds its singleton at import time (bottom of the file), so any
 * throw in the constructor happens at MODULE SCOPE and takes down whatever
 * imported it — in practice queryClient.ts, and therefore every test file that
 * touches it. The old checks were four separate `typeof window !== 'undefined'`
 * guards, each of which then reached for something else: document, and
 * window.location. That holds in a browser and in plain Node, and fails in
 * between: this repo's vitest suite runs every file in ONE fork where something
 * defines a global `window` with no `document` and no `location`, so
 * crm-kpi-pagination.test.ts failed about half the time, passed in isolation,
 * and moved to a different line each time a single guard was patched. Partial
 * DOM shims and SSR environments have the same shape.
 *
 * So the predicate asks for the three globals this file actually uses, together.
 * Everything else here (localStorage, navigator, sendBeacon) was already either
 * try/caught or feature-detected on its own.
 */
function hasBrowserGlobals(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof window.location !== 'undefined'
  );
}

class MobileLogger {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private deviceId: string;
  private sessionId: string;
  private platform: string;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.generateId();
    this.platform = this.detectPlatform();
    this.startFlushTimer();
    this.attachGlobalHandlers();

    // Startup diagnostic - confirms logger pipeline is working
    this.info('MobileLogger initialized', {
      deviceId: this.deviceId.slice(0, 12),
      platform: this.platform,
      appVersion: config.appVersion,
      apiBaseUrl: config.apiBaseUrl || '(relative)',
      isProduction: config.isProduction,
    });
  }

  private getOrCreateDeviceId(): string {
    const key = 'printyx_device_id';
    let id = '';
    try {
      id = localStorage.getItem(key) || '';
    } catch {
      // localStorage unavailable
    }
    if (!id) {
      id = this.generateId();
      try {
        localStorage.setItem(key, id);
      } catch {
        // ignore
      }
    }
    return id;
  }

  private generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  private detectPlatform(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    if (/Mobi/.test(ua)) return 'mobile-web';
    return 'web';
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private attachGlobalHandlers() {
    if (!hasBrowserGlobals()) return;

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('Unhandled error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack?.slice(0, 500),
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.error('Unhandled promise rejection', {
        message: reason?.message || String(reason),
        stack: reason?.stack?.slice(0, 500),
      });
    });

    // Flush on page unload (use beacon for reliability during navigation)
    window.addEventListener('beforeunload', () => this.beaconFlush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.beaconFlush();
    });
  }

  private addEntry(level: LogEntry['level'], message: string, data?: Record<string, unknown>) {
    const screen = hasBrowserGlobals() ? window.location.pathname : undefined;
    this.buffer.push({
      level,
      message,
      screen,
      data,
      timestamp: new Date().toISOString(),
    });

    // Auto-flush if buffer is full or on error
    if (this.buffer.length >= MAX_BUFFER_SIZE || level === 'error') {
      this.flush();
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.addEntry('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.addEntry('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.addEntry('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.addEntry('error', message, data);
  }

  /**
   * Log a React ErrorBoundary catch
   */
  logErrorBoundary(error: Error, errorInfo?: { componentStack?: string }) {
    this.error('ErrorBoundary caught', {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: errorInfo?.componentStack?.slice(0, 500),
      url: hasBrowserGlobals() ? window.location.href : undefined,
    });
  }

  /**
   * Send buffered entries to the mobile-logs endpoint.
   * Tries multiple strategies to maximize delivery reliability:
   * 1. fetch() to Express backend (same-origin, most reliable)
   * 2. fetch() to Edge Function (cross-origin, for production)
   * 3. sendBeacon as last resort (page unload)
   */
  flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const payload = {
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      platform: this.platform,
      appVersion: config.appVersion,
      entries,
    };

    const body = JSON.stringify(payload);

    // In production, use Edge Function URL; in dev, use same-origin Express backend
    const logUrl = config.isProduction ? `${config.apiBaseUrl}/mobile-logs` : '/api/mobile-logs';

    fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  /**
   * Beacon-based flush for page unload (sendBeacon is more reliable during navigation)
   */
  private beaconFlush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const payload = {
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      platform: this.platform,
      appVersion: config.appVersion,
      entries,
    };

    try {
      // Use text/plain to avoid CORS preflight issues with sendBeacon
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      const beaconUrl = config.isProduction
        ? `${config.apiBaseUrl}/mobile-logs`
        : '/api/mobile-logs';
      navigator.sendBeacon?.(beaconUrl, blob);
    } catch {
      // Best effort
    }
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

// Singleton instance
export const mobileLogger = new MobileLogger();
