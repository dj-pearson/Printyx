/**
 * Health Endpoints for Kubernetes/Orchestration
 *
 * These endpoints provide health checks for container orchestration platforms:
 * - /health - Basic health check with version and uptime
 * - /ready - Readiness probe (database AND Redis reachable)
 * - /live - Liveness probe (event loop responsive)
 * - /health/detailed - Detailed metrics (platform admin only)
 *
 * Standards:
 * - Returns 200 for healthy, 503 for unhealthy
 * - Kubernetes probes use /ready and /live
 * - /health/detailed provides detailed status for monitoring dashboards
 */

import type { Express, Request, Response } from 'express';
import { pool, getDbHealth } from '../db';
import { getMonitoringHealth, getQueryStats } from '../lib/monitoring';
import { checkJwtConfiguration } from '../lib/env-validation';
import { getCacheSync } from '../lib/redis-client';
import { requireSupabaseAuth as requireAuth } from '../middleware/supabase-auth';
import { isPlatformAdmin } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('health-routes');

// Track last successful database check
let lastDbCheckTime = 0;
let lastDbCheckSuccess = false;
const DB_CHECK_CACHE_MS = 5000; // Cache DB check results for 5 seconds

/**
 * Check database connectivity with caching to avoid overwhelming the database
 */
async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
}> {
  // Return cached result if recent
  if (Date.now() - lastDbCheckTime < DB_CHECK_CACHE_MS) {
    return {
      healthy: lastDbCheckSuccess,
      responseTimeMs: 0,
      error: lastDbCheckSuccess ? undefined : 'Using cached unhealthy status',
    };
  }

  const startTime = Date.now();
  try {
    const result = await pool.query('SELECT 1 as health_check');
    const responseTimeMs = Date.now() - startTime;

    lastDbCheckTime = Date.now();
    lastDbCheckSuccess = result.rows.length > 0;

    return {
      healthy: lastDbCheckSuccess,
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    lastDbCheckTime = Date.now();
    lastDbCheckSuccess = false;

    return {
      healthy: false,
      responseTimeMs,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis/cache connectivity
 */
function checkRedisHealth(): { healthy: boolean; type: string } {
  try {
    const cache = getCacheSync();
    return {
      healthy: cache.isConnected(),
      type: cache.isConnected() ? 'redis' : 'memory',
    };
  } catch {
    return { healthy: false, type: 'unavailable' };
  }
}

/**
 * Get system resource metrics
 */
function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  return {
    memoryUsageMB: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
    },
    cpuUsage: process.cpuUsage(),
  };
}

/**
 * Register health endpoints
 */
export function registerHealthRoutes(app: Express): void {
  /**
   * GET /health - Basic health check
   * Returns { status: 'ok', version, uptime, timestamp }
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /ready - Readiness probe
   * Returns 200 only when database AND Redis are reachable
   * Returns 503 with degraded status otherwise
   */
  app.get('/ready', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    const redisHealth = checkRedisHealth();

    const dbOk = dbHealth.healthy;
    const redisOk = redisHealth.healthy;
    const allOk = dbOk && redisOk;

    if (allOk) {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          redis: 'ok',
        },
      });
    } else {
      res.status(503).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbOk ? 'ok' : 'fail',
          redis: redisOk ? 'ok' : 'fail',
        },
      });
    }
  });

  /**
   * GET /live - Liveness probe
   * Returns 200 if the event loop is responsive (not deadlocked)
   */
  app.get('/live', (_req: Request, res: Response) => {
    // If this handler executes, the event loop is responsive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * GET /health/detailed - Detailed health metrics (platform admin only)
   * Returns memory usage, CPU, connection pool stats, WebSocket count, queue depths
   */
  app.get('/health/detailed', requireAuth, async (req: Request, res: Response) => {
    if (!isPlatformAdmin(req)) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }

    const dbHealth = await checkDatabaseHealth();
    const redisHealth = checkRedisHealth();
    const jwtConfig = checkJwtConfiguration();
    const monitoringHealth = getMonitoringHealth();
    const systemMetrics = getSystemMetrics();
    const dbHealthStats = getDbHealth();

    // Get WebSocket client count dynamically
    let activeWebSocketCount = 0;
    try {
      const { webSocketService } = await import('../websocket-service');
      activeWebSocketCount = webSocketService.getConnectedClients();
    } catch {
      // WebSocket service may not be initialized
    }

    const memoryPercent = Math.round(
      (systemMetrics.memoryUsageMB.heapUsed / systemMetrics.memoryUsageMB.heapTotal) * 100,
    );

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        ...systemMetrics.memoryUsageMB,
        percentUsed: memoryPercent,
      },
      cpu: systemMetrics.cpuUsage,
      connectionPool: dbHealthStats.poolStats,
      activeWebSocketCount,
      queueDepths: {
        dbWaiting: dbHealthStats.poolStats.waitingCount,
      },
      checks: {
        database: {
          status: dbHealth.healthy ? 'ok' : 'fail',
          responseTimeMs: dbHealth.responseTimeMs,
          circuitState: dbHealthStats.circuitState,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
        redis: {
          status: redisHealth.healthy ? 'ok' : 'fail',
          type: redisHealth.type,
        },
        jwt: {
          configured: jwtConfig.configured,
          components: {
            supabaseUrl: jwtConfig.supabaseUrl,
            anonKey: jwtConfig.anonKey,
            jwtSecret: jwtConfig.jwtSecret,
            serviceRoleKey: jwtConfig.serviceRoleKey,
          },
        },
        monitoring: {
          initialized: monitoringHealth.initialized,
          apm: monitoringHealth.apm,
          logging: monitoringHealth.logging,
        },
      },
      queryStats: getQueryStats(),
    });
  });

  /**
   * Kubernetes-style healthz endpoint (alias for /health)
   */
  app.get('/healthz', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.healthy) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'error', error: dbHealth.error });
    }
  });

  /**
   * Kubernetes-style readyz endpoint (alias for /ready)
   */
  app.get('/readyz', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.healthy) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'error', error: dbHealth.error });
    }
  });

  /**
   * Kubernetes-style livez endpoint (alias for /live)
   */
  app.get('/livez', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });
}
