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
    if (typeof window === 'undefined') return;

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

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  private addEntry(level: LogEntry['level'], message: string, data?: Record<string, unknown>) {
    const screen = typeof window !== 'undefined' ? window.location.pathname : undefined;
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
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }

  /**
   * Send buffered entries to the mobile-logs edge function
   */
  flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const url = config.isProduction
      ? `${config.apiBaseUrl}/mobile-logs`
      : '/api/mobile-logs';

    const payload = {
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      platform: this.platform,
      appVersion: config.appVersion,
      entries,
    };

    // Fire-and-forget using sendBeacon for reliability, fallback to fetch
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon?.(url, blob);
      if (!sent) {
        throw new Error('sendBeacon failed');
      }
    } catch {
      // Fallback to fetch
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Logging should never crash the app
      });
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
