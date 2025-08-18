/**
 * Database Updater API Routes
 * REST endpoints for Root Admin control of the database updater system
 */

import express from 'express';
import { DatabaseUpdaterManager } from '../DatabaseUpdaterManager';
import { Logger } from '../core/Logger';

const router = express.Router();

// Global updater manager instance
let updaterManager: DatabaseUpdaterManager | null = null;
const logger = new Logger({ level: 'info' });

/**
 * Initialize updater manager
 */
function getUpdaterManager() {
  if (!updaterManager) {
    updaterManager = new DatabaseUpdaterManager({
      logLevel: 'info',
      enableScheduling: true,
    });
  }
  return updaterManager;
}

/**
 * GET /api/database-updater/status
 * Get status of the updater system
 */
router.get('/status', async (req, res) => {
  try {
    const manager = getUpdaterManager();
    const status = manager.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get updater status', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/database-updater/start
 * Start the updater system
 */
router.post('/start', async (req, res) => {
  try {
    const manager = getUpdaterManager();
    await manager.start();
    
    res.json({
      success: true,
      message: 'Database updater system started successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to start updater system', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/database-updater/stop
 * Stop the updater system
 */
router.post('/stop', async (req, res) => {
  try {
    const manager = getUpdaterManager();
    await manager.stop();
    
    res.json({
      success: true,
      message: 'Database updater system stopped successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to stop updater system', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/database-updater/execute/:updaterName
 * Execute a specific updater manually
 */
router.post('/execute/:updaterName', async (req, res) => {
  try {
    const { updaterName } = req.params;
    const manager = getUpdaterManager();
    
    await manager.executeUpdater(updaterName);
    
    res.json({
      success: true,
      message: `Updater ${updaterName} executed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Failed to execute updater: ${req.params.updaterName}`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/database-updater/config
 * Update configuration
 */
router.put('/config', async (req, res) => {
  try {
    const { config } = req.body;
    const manager = getUpdaterManager();
    
    await manager.updateConfiguration(config);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update configuration', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/database-updater/logs
 * Get recent log entries
 */
router.get('/logs', async (req, res) => {
  try {
    const { count = 100 } = req.query;
    const logCount = Math.min(parseInt(count as string) || 100, 1000);
    
    const logs = logger.getRecentLogs(logCount);
    
    res.json({
      success: true,
      data: {
        logs,
        count: logs.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get logs', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/database-updater/metrics
 * Get system metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const manager = getUpdaterManager();
    const status = manager.getStatus();
    
    // Compile metrics from all updaters
    const metrics = {
      systemMetrics: {
        isRunning: status.isRunning,
        totalUpdaters: status.updaters.length,
        enabledUpdaters: status.updaters.filter(u => u.isEnabled).length,
        nextExecutions: status.nextExecutions,
      },
      updaterMetrics: status.updaters.map(updater => ({
        name: updater.name,
        isEnabled: updater.isEnabled,
        lastExecution: updater.lastExecution,
        config: updater.config,
      })),
      configuration: status.config,
    };
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/database-updater/dry-run/:updaterName
 * Execute updater in dry-run mode
 */
router.post('/dry-run/:updaterName', async (req, res) => {
  try {
    const { updaterName } = req.params;
    
    // Create a temporary manager in dry-run mode
    const dryRunManager = new DatabaseUpdaterManager({
      dryRun: true,
      enableScheduling: false,
      logLevel: 'debug',
    });
    
    await dryRunManager.executeUpdater(updaterName);
    const status = dryRunManager.getStatus();
    
    res.json({
      success: true,
      message: `Dry-run completed for ${updaterName}`,
      data: {
        updater: status.updaters.find(u => u.name === updaterName),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Failed to execute dry-run for: ${req.params.updaterName}`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/database-updater/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const manager = getUpdaterManager();
    const status = manager.getStatus();
    
    const health = {
      status: 'healthy',
      updaterSystemRunning: status.isRunning,
      totalUpdaters: status.updaters.length,
      timestamp: new Date().toISOString(),
    };
    
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error in updater routes', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

export default router;
