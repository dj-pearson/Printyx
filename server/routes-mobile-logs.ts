/**
 * Mobile App Remote Logging Endpoint
 *
 * POST /api/mobile-logs       - Receive a batch of log entries (no auth)
 * GET  /api/mobile-logs/health - Health check
 * GET  /api/mobile-logs/recent - View recent in-memory logs (debug)
 *
 * Admin endpoints (platform admin only):
 * GET    /api/admin/mobile-logs  - Paginated DB query with filters
 * DELETE /api/admin/mobile-logs  - Purge logs older than N days
 */

import express, { Router, Request, Response } from 'express';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { isPlatformAdmin } from './utils/auth-helpers';
import { db } from './db';
import { mobileAppLogs } from '@shared/schema';
import { desc, eq, ilike, and, sql, lt } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('mobile-remote');

const router = Router();

// Parse text/plain bodies (from sendBeacon) as raw text so we can JSON.parse manually
router.use(express.text({ type: 'text/plain', limit: '1mb' }));

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
 * Accepts both application/json and text/plain (from sendBeacon).
 */
router.post('/', (req: Request, res: Response) => {
  // Handle text/plain from sendBeacon (body may be unparsed string)
  let batch: MobileLogBatch;
  if (typeof req.body === 'string') {
    try {
      batch = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'invalid JSON in text/plain body' });
    }
  } else {
    batch = req.body as MobileLogBatch;
  }

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

  // Persist to DB (fire-and-forget)
  const rows = batch.entries.map((entry) => ({
    deviceId: batch.deviceId || null,
    sessionId: batch.sessionId || null,
    platform: batch.platform || null,
    appVersion: batch.appVersion || null,
    level: entry.level || 'info',
    message: String(entry.message || ''),
    screen: entry.screen || null,
    data: entry.data || null,
    logTimestamp: entry.timestamp ? new Date(entry.timestamp) : null,
  }));

  db.insert(mobileAppLogs)
    .values(rows)
    .catch((err) => log.error('DB insert failed (non-fatal):', err.message));

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

// ─── Admin Endpoints (registered separately with auth) ─────────────────

export function registerMobileLogsAdminRoutes(app: import('express').Express) {
  /**
   * GET /api/admin/mobile-logs - Paginated mobile logs from DB
   * Query params: level, screen, search, deviceId, sessionId, page, limit
   */
  app.get('/api/admin/mobile-logs', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const conditions: any[] = [];

      const level = req.query.level as string;
      if (level) {
        conditions.push(eq(mobileAppLogs.level, level));
      }

      const screen = req.query.screen as string;
      if (screen) {
        conditions.push(ilike(mobileAppLogs.screen, `%${screen}%`));
      }

      const search = req.query.search as string;
      if (search) {
        conditions.push(ilike(mobileAppLogs.message, `%${search}%`));
      }

      const deviceId = req.query.deviceId as string;
      if (deviceId) {
        conditions.push(eq(mobileAppLogs.deviceId, deviceId));
      }

      const sessionId = req.query.sessionId as string;
      if (sessionId) {
        conditions.push(eq(mobileAppLogs.sessionId, sessionId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [logs, countResult] = await Promise.all([
        db
          .select()
          .from(mobileAppLogs)
          .where(whereClause)
          .orderBy(desc(mobileAppLogs.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(mobileAppLogs)
          .where(whereClause),
      ]);

      const total = countResult[0]?.count || 0;

      return res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      log.error('Failed to query mobile logs', { error: error.message });
      return res.status(500).json({ message: 'Failed to retrieve mobile logs' });
    }
  });

  /**
   * DELETE /api/admin/mobile-logs - Purge logs older than N days
   * Query param: olderThanDays (default 30)
   */
  app.delete('/api/admin/mobile-logs', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req)) {
        return res.status(403).json({ message: 'Forbidden: platform admin access required' });
      }

      const days = Math.max(1, parseInt(req.query.olderThanDays as string) || 30);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const result = await db.delete(mobileAppLogs).where(lt(mobileAppLogs.createdAt, cutoff));

      return res.json({
        message: `Purged logs older than ${days} days`,
        cutoff: cutoff.toISOString(),
      });
    } catch (error: any) {
      log.error('Failed to purge mobile logs', { error: error.message });
      return res.status(500).json({ message: 'Failed to purge mobile logs' });
    }
  });
}
