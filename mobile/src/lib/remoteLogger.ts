/**
 * Remote Logger for Printyx Mobile
 *
 * Batches log entries and sends them to the mobile-logs edge function at
 * POST https://functions.printyx.net/mobile-logs. Logs are visible in the
 * edge function server console, allowing real-time debugging of mobile issues.
 *
 * Usage:
 *   import { remoteLog } from '@/lib/remoteLogger';
 *   remoteLog.info('Loaded 5 deals', { count: 5 }, 'DealsScreen');
 *   remoteLog.error('Fetch failed', { url, status }, 'apiRequest');
 */

import { config, getEdgeFunctionUrl } from '@/config';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  screen?: string;
  requestId?: string;
}

// Buffer for batching log entries
const buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 2000; // Send every 2 seconds
const MAX_BUFFER_SIZE = 20; // Or when buffer hits 20 entries

// Unique device/session identifiers
const sessionId = Crypto.randomUUID();
const deviceId = `${Platform.OS}-${Crypto.randomUUID().slice(0, 8)}`;

function getLogUrl(): string {
  return getEdgeFunctionUrl('mobile-logs');
}

/**
 * Flush buffered logs to the server.
 * Fire-and-forget — never throws or blocks the app.
 */
async function flush(): Promise<void> {
  if (buffer.length === 0) return;

  const entries = buffer.splice(0, buffer.length);

  try {
    await fetch(getLogUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        sessionId,
        platform: Platform.OS,
        appVersion: Application.nativeApplicationVersion || config.appVersion,
        entries,
      }),
    });
  } catch {
    // Logging endpoint unreachable — silently drop.
    // Also log locally for Expo/Metro console.
    if (__DEV__) {
      console.warn('[remoteLog] Failed to flush', entries.length, 'entries to server');
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

function addEntry(level: LogLevel, message: string, data?: any, screen?: string) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    screen,
  };

  // Sanitize data — strip large bodies, circular refs
  if (data !== undefined) {
    try {
      const str = JSON.stringify(data);
      entry.data = str.length > 2000 ? JSON.parse(str.slice(0, 2000) + '..."') : data;
    } catch {
      entry.data = String(data);
    }
  }

  buffer.push(entry);

  // Also log locally in dev for Metro console
  if (__DEV__) {
    const prefix = screen ? `[${screen}]` : '';
    const localMsg = `[remoteLog:${level}]${prefix} ${message}`;
    if (data) {
      console.log(localMsg, data);
    } else {
      console.log(localMsg);
    }
  }

  // Flush immediately if buffer is large, otherwise schedule
  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

export const remoteLog = {
  debug: (message: string, data?: any, screen?: string) =>
    addEntry('debug', message, data, screen),
  info: (message: string, data?: any, screen?: string) =>
    addEntry('info', message, data, screen),
  warn: (message: string, data?: any, screen?: string) =>
    addEntry('warn', message, data, screen),
  error: (message: string, data?: any, screen?: string) =>
    addEntry('error', message, data, screen),

  /** Force-flush any buffered entries (e.g., before app backgrounds) */
  flush,

  /** Session and device identifiers for correlation */
  sessionId,
  deviceId,
};
