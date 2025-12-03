/**
 * Health Endpoints for Kubernetes/Orchestration
 *
 * These endpoints provide health checks for container orchestration platforms:
 * - /health - Comprehensive health check with dependency status
 * - /ready - Readiness probe (can the app handle traffic?)
 * - /live - Liveness probe (is the app alive?)
 *
 * Standards:
 * - Returns 200 for healthy, 503 for unhealthy
 * - Kubernetes probes use /ready and /live
 * - /health provides detailed status for monitoring dashboards
 */

import type { Express, Request, Response } from 'express';
import { pool } from '../db';
import { getMonitoringHealth, getQueryStats } from '../lib/monitoring';

// Track server start time for uptime calculation
const serverStartTime = Date.now();

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
    // Simple query to verify database connectivity
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
 * Get system resource metrics
 */
function getSystemMetrics(): {
  uptimeSeconds: number;
  memoryUsageMB: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: NodeJS.CpuUsage;
} {
  const memoryUsage = process.memoryUsage();
  return {
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
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
 * Health check response type
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTimeMs: number;
      error?: string;
    };
    monitoring: {
      status: 'healthy' | 'degraded';
      initialized: boolean;
      apm: { enabled: boolean; provider?: string };
      logging: { level: string; transport?: string };
    };
    memory: {
      status: 'healthy' | 'warning' | 'critical';
      heapUsedMB: number;
      heapTotalMB: number;
      percentUsed: number;
    };
  };
  queryStats?: ReturnType<typeof getQueryStats>;
}

/**
 * Register health endpoints
 */
export function registerHealthRoutes(app: Express): void {
  /**
   * Comprehensive health check
   * Returns detailed status of all system components
   * Used by monitoring dashboards and load balancers
   */
  app.get('/health', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    const monitoringHealth = getMonitoringHealth();
    const systemMetrics = getSystemMetrics();

    const memoryPercent = Math.round(
      (systemMetrics.memoryUsageMB.heapUsed / systemMetrics.memoryUsageMB.heapTotal) * 100
    );

    // Determine memory health status
    let memoryStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (memoryPercent > 90) {
      memoryStatus = 'critical';
    } else if (memoryPercent > 80) {
      memoryStatus = 'warning';
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!dbHealth.healthy) {
      overallStatus = 'unhealthy';
    } else if (memoryStatus === 'critical' || !monitoringHealth.initialized) {
      overallStatus = 'degraded';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: systemMetrics.uptimeSeconds,
      checks: {
        database: {
          status: dbHealth.healthy ? 'healthy' : 'unhealthy',
          responseTimeMs: dbHealth.responseTimeMs,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
        monitoring: {
          status: monitoringHealth.initialized ? 'healthy' : 'degraded',
          initialized: monitoringHealth.initialized,
          apm: monitoringHealth.apm,
          logging: monitoringHealth.logging,
        },
        memory: {
          status: memoryStatus,
          heapUsedMB: systemMetrics.memoryUsageMB.heapUsed,
          heapTotalMB: systemMetrics.memoryUsageMB.heapTotal,
          percentUsed: memoryPercent,
        },
      },
    };

    // Include query stats in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      response.queryStats = getQueryStats();
    }

    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);
  });

  /**
   * Readiness probe
   * Returns 200 if the app is ready to handle traffic
   * Used by Kubernetes to determine if pod should receive traffic
   */
  app.get('/ready', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.healthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'connected',
        },
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'disconnected',
        },
        error: dbHealth.error,
      });
    }
  });

  /**
   * Liveness probe
   * Returns 200 if the app is alive (basic process health)
   * Used by Kubernetes to determine if pod should be restarted
   */
  app.get('/live', (_req: Request, res: Response) => {
    // Liveness should be a simple check that the process is responding
    // It should NOT check external dependencies
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    });
  });

  /**
   * Kubernetes-style healthz endpoint (alias for /health)
   */
  app.get('/healthz', async (req: Request, res: Response) => {
    // Forward to /health handler
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
  app.get('/readyz', async (req: Request, res: Response) => {
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
