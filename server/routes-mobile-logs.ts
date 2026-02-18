/**
 * Mobile App Remote Logging Endpoint
 *
 * Receives log entries from the mobile app and prints them to the
 * Express server console. This allows debugging mobile issues by
 * viewing real-time logs from the iOS/Android app in the server output.
 *
 * POST /api/mobile-logs - Receive a batch of log entries
 * GET  /api/mobile-logs/health - Health check (verify endpoint is reachable)
 */

import { Router, Request, Response } from 'express';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('mobile-remote');

const router = Router();

interface MobileLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  timestamp?: string;
  screen?: string;
  requestId?: string;
}

interface MobileLogBatch {
  deviceId?: string;
  platform?: string;
  appVersion?: string;
  sessionId?: string;
  entries: MobileLogEntry[];
}

// Store recent logs in memory for quick access (circular buffer, last 500)
const recentLogs: Array<MobileLogEntry & { deviceId?: string; receivedAt: string }> = [];
const MAX_LOGS = 500;

function addLog(entry: MobileLogEntry, deviceId?: string) {
  recentLogs.push({
    ...entry,
    deviceId,
    receivedAt: new Date().toISOString(),
  });
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.shift();
  }
}

/**
 * POST /api/mobile-logs - Receive log entries from mobile app
 * No auth required so logging works even when auth is broken.
 */
router.post('/', (req: Request, res: Response) => {
  const batch = req.body as MobileLogBatch;

  if (!batch?.entries || !Array.isArray(batch.entries)) {
    return res.status(400).json({ error: 'entries array required' });
  }

  const prefix = batch.deviceId
    ? `[${batch.platform || 'mobile'}:${batch.deviceId.slice(0, 8)}]`
    : '[mobile]';

  for (const entry of batch.entries) {
    const ts = entry.timestamp || new Date().toISOString();
    const screen = entry.screen ? ` (${entry.screen})` : '';
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    const line = `${prefix}${screen} ${entry.message}${dataStr}`;

    switch (entry.level) {
      case 'error':
        log.error(`📱 ${ts} ${line}`);
        break;
      case 'warn':
        log.warn(`📱 ${ts} ${line}`);
        break;
      case 'info':
        log.info(`📱 ${ts} ${line}`);
        break;
      default:
        log.debug(`📱 ${ts} ${line}`);
    }

    addLog(entry, batch.deviceId);
  }

  res.json({ received: batch.entries.length });
});

/**
 * GET /api/mobile-logs/health - Health check
 * Mobile app calls this on startup to verify logging endpoint is reachable.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/mobile-logs/recent - View recent logs (for debugging via browser)
 * Optional query params: ?level=error&limit=50&screen=deals
 */
router.get('/recent', (req: Request, res: Response) => {
  let filtered = [...recentLogs];

  const level = req.query.level as string;
  if (level) {
    filtered = filtered.filter((l) => l.level === level);
  }

  const screen = req.query.screen as string;
  if (screen) {
    filtered = filtered.filter((l) => l.screen?.includes(screen));
  }

  const limit = parseInt(req.query.limit as string) || 100;
  filtered = filtered.slice(-limit);

  res.json({ count: filtered.length, logs: filtered });
});

export default router;
