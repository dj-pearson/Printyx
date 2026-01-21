/**
 * Performance Monitoring Routes
 * API endpoints for system performance monitoring and optimization
 */

import express from 'express';
import PerformanceMonitor from '../services/performance-monitor';

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id', role: 'admin' };
  next();
};

/**
 * GET /api/performance/health
 * Get overall system health status
 */
router.get('/health', async (req, res) => {
  try {
    const systemHealth = await PerformanceMonitor.getSystemHealth();
    res.json(systemHealth);
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

/**
 * GET /api/performance/metrics
 * Get current performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { timeRange = 'hour' } = req.query;

    const report = PerformanceMonitor.generatePerformanceReport(
      timeRange as 'hour' | 'day' | 'week',
    );

    res.json(report);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/performance/insights
 * Get performance insights and recommendations
 */
router.get('/insights', async (req, res) => {
  try {
    const insights = PerformanceMonitor.getPerformanceInsights();
    res.json(insights);
  } catch (error) {
    console.error('Error fetching performance insights:', error);
    res.status(500).json({ error: 'Failed to fetch performance insights' });
  }
});

/**
 * POST /api/performance/record-metric
 * Record a custom performance metric
 */
router.post('/record-metric', async (req, res) => {
  try {
    const { name, value, unit, metadata } = req.body;

    if (!name || value === undefined || !unit) {
      return res.status(400).json({
        error: 'Name, value, and unit are required',
      });
    }

    PerformanceMonitor.recordMetric(name, value, unit, metadata);

    res.json({
      success: true,
      message: 'Metric recorded successfully',
      metric: { name, value, unit, timestamp: new Date() },
    });
  } catch (error) {
    console.error('Error recording metric:', error);
    res.status(500).json({ error: 'Failed to record metric' });
  }
});

/**
 * GET /api/performance/database
 * Get database performance metrics
 */
router.get('/database', async (req, res) => {
  try {
    const dbPerformance = await PerformanceMonitor.getDatabasePerformance();
    res.json(dbPerformance);
  } catch (error) {
    console.error('Error fetching database performance:', error);
    res.status(500).json({ error: 'Failed to fetch database performance' });
  }
});

/**
 * GET /api/performance/ai
 * Get AI performance metrics
 */
router.get('/ai', async (req, res) => {
  try {
    const aiPerformance = await PerformanceMonitor.getAIPerformance();
    res.json(aiPerformance);
  } catch (error) {
    console.error('Error fetching AI performance:', error);
    res.status(500).json({ error: 'Failed to fetch AI performance' });
  }
});

/**
 * GET /api/performance/cache
 * Get cache performance metrics
 */
router.get('/cache', async (req, res) => {
  try {
    const cachePerformance = await PerformanceMonitor.getCachePerformance();
    res.json(cachePerformance);
  } catch (error) {
    console.error('Error fetching cache performance:', error);
    res.status(500).json({ error: 'Failed to fetch cache performance' });
  }
});

/**
 * POST /api/performance/run-tests
 * Trigger performance tests
 */
router.post('/run-tests', async (req, res) => {
  try {
    const { testSuite = 'all' } = req.body;

    // Mock test execution
    const testResults = {
      testSuite,
      status: 'completed',
      startTime: new Date(),
      duration: Math.floor(Math.random() * 5000) + 1000, // 1-6 seconds
      results: {
        'Task Scheduling Algorithm': {
          totalTests: 25,
          passed: 23,
          failed: 2,
          coverage: 89,
          duration: 1250,
        },
        'API Endpoints': {
          totalTests: 42,
          passed: 40,
          failed: 2,
          coverage: 95,
          duration: 2340,
        },
        'Calendar Integration': {
          totalTests: 18,
          passed: 17,
          failed: 1,
          coverage: 92,
          duration: 890,
        },
        'Claude AI Integration': {
          totalTests: 15,
          passed: 14,
          failed: 1,
          coverage: 87,
          duration: 3450,
        },
      },
    };

    // Record test performance metrics
    PerformanceMonitor.recordMetric('test_execution_time', testResults.duration, 'ms', {
      testSuite,
      totalTests: 100,
    });

    res.json(testResults);
  } catch (error) {
    console.error('Error running tests:', error);
    res.status(500).json({ error: 'Failed to run tests' });
  }
});

/**
 * POST /api/performance/optimize
 * Trigger system optimization
 */
router.post('/optimize', async (req, res) => {
  try {
    const { optimizationType = 'all' } = req.body;

    // Mock optimization process
    const optimizationResults = {
      type: optimizationType,
      status: 'completed',
      startTime: new Date(),
      duration: Math.floor(Math.random() * 3000) + 500, // 0.5-3.5 seconds
      improvements: [],
      metrics: {
        before: {},
        after: {},
        improvement: {},
      },
    };

    switch (optimizationType) {
      case 'database':
        optimizationResults.improvements = [
          'Optimized slow queries',
          'Updated database indexes',
          'Cleaned up unused connections',
        ];
        optimizationResults.metrics = {
          before: { averageQueryTime: 245, slowQueries: 8 },
          after: { averageQueryTime: 145, slowQueries: 2 },
          improvement: { queryTimeReduction: '40.8%', slowQueriesReduced: '75%' },
        };
        break;

      case 'cache':
        optimizationResults.improvements = [
          'Cleared expired cache entries',
          'Optimized cache keys',
          'Adjusted TTL settings',
        ];
        optimizationResults.metrics = {
          before: { hitRate: 82.3, memoryUsage: 156 },
          after: { hitRate: 89.1, memoryUsage: 128 },
          improvement: { hitRateIncrease: '8.3%', memoryReduction: '17.9%' },
        };
        break;

      case 'ai':
        optimizationResults.improvements = [
          'Optimized Claude API request batching',
          'Implemented response caching',
          'Reduced token usage',
        ];
        optimizationResults.metrics = {
          before: { latency: 1200, tokensPerDay: 52000, costPerDay: 15.6 },
          after: { latency: 850, tokensPerDay: 45000, costPerDay: 13.5 },
          improvement: { latencyReduction: '29.2%', costSavings: '13.5%' },
        };
        break;

      default:
        optimizationResults.improvements = [
          'Database query optimization',
          'Cache performance tuning',
          'AI request optimization',
          'Memory cleanup',
        ];
        optimizationResults.metrics = {
          before: { overallScore: 72 },
          after: { overallScore: 84 },
          improvement: { scoreIncrease: '16.7%' },
        };
    }

    // Record optimization metrics
    PerformanceMonitor.recordMetric(
      'optimization_execution_time',
      optimizationResults.duration,
      'ms',
      { optimizationType },
    );

    res.json(optimizationResults);
  } catch (error) {
    console.error('Error running optimization:', error);
    res.status(500).json({ error: 'Failed to run optimization' });
  }
});

/**
 * GET /api/performance/alerts
 * Get performance alerts and warnings
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [
      {
        id: 'alert-1',
        type: 'warning',
        title: 'Claude API Latency High',
        message: 'Claude API response time is above 2 seconds',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        severity: 'medium',
        category: 'ai',
        resolved: false,
      },
      {
        id: 'alert-2',
        type: 'info',
        title: 'Test Suite Completed',
        message: 'All automated tests completed successfully',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        severity: 'low',
        category: 'testing',
        resolved: true,
      },
      {
        id: 'alert-3',
        type: 'error',
        title: 'Database Query Performance',
        message: '3 slow queries detected in the last hour',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        severity: 'high',
        category: 'database',
        resolved: false,
      },
    ];

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /api/performance/alerts/:alertId/resolve
 * Mark an alert as resolved
 */
router.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;

    // Mock alert resolution
    const resolvedAlert = {
      id: alertId,
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
      resolution: resolution || 'Manually resolved',
    };

    res.json(resolvedAlert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * GET /api/performance/reports/generate
 * Generate comprehensive performance report
 */
router.get('/reports/generate', async (req, res) => {
  try {
    const { format = 'json', timeRange = 'week' } = req.query;

    const report = {
      generatedAt: new Date(),
      timeRange,
      format,
      summary: {
        overallScore: 82,
        totalTests: 100,
        passedTests: 94,
        failedTests: 6,
        averageResponseTime: 125,
        uptime: 99.8,
        criticalIssues: 1,
        warnings: 3,
      },
      sections: {
        testing: {
          testSuites: 4,
          totalTests: 100,
          coverage: 91,
          failureRate: 6,
          trends: 'improving',
        },
        performance: {
          databaseQueryTime: 145,
          apiResponseTime: 125,
          claudeApiLatency: 850,
          cacheHitRate: 87,
          trends: 'stable',
        },
        optimization: {
          lastOptimized: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          improvements: 8,
          performanceGain: 15.2,
          costSavings: 12.3,
        },
      },
      recommendations: [
        'Optimize Claude API request caching to reduce latency',
        'Review and fix 6 failing test cases',
        'Consider database index optimization for slow queries',
        'Implement automated performance monitoring alerts',
      ],
    };

    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
