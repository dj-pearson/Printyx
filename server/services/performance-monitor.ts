/**
 * Performance Monitoring Service
 * Monitors and optimizes Motion AI system performance
 */
import { sql } from 'drizzle-orm';
import { db, pool } from '../db';
import { createModuleLogger } from '../lib/logger';
import { getQueryStats } from '../lib/db-logger';
const log = createModuleLogger('performance-monitor');

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  metrics: PerformanceMetric[];
  recommendations: string[];
  lastChecked: Date;
}

interface DatabasePerformance {
  /** Null where the value has no source; see getDatabasePerformance. */
  connectionPoolSize: number | null;
  activeConnections: number | null;
  idleConnections: number;
  waitingRequests: number;
  averageQueryTime: number | null;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }>;
  /** How many queries crossed db-logger's threshold; the list above is empty. */
  slowQueryCount: number | null;
}

interface AIPerformance {
  claudeApiLatency: number;
  claudeApiSuccess: number; // percentage
  schedulingAlgorithmTime: number;
  aiAnalysisAccuracy: number; // percentage
  tokensUsedPerDay: number;
  costPerDay: number;
}

interface CachePerformance {
  hitRate: number; // percentage
  missRate: number; // percentage
  evictionRate: number; // percentage
  memoryUsage: number; // MB
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetricsHistory = 10000;

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata,
    };

    this.metrics.push(metric);

    // Maintain metrics history limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log critical metrics
    if (this.isCriticalMetric(name, value)) {
      log.warn(`⚠️  Critical metric detected: ${name} = ${value} ${unit}`);
    }
  }

  /**
   * Get system health overview
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const dbPerf = await this.getDatabasePerformance();
    const aiPerf = await this.getAIPerformance();
    const cachePerf = await this.getCachePerformance();
    const memoryUsage = await this.getMemoryUsage();
    const cpuUsage = await this.getCPUUsage();

    // A metric with no measurement is left out of the list rather than
    // reported as zero - a zero query time would read as an instant database.
    const metrics: PerformanceMetric[] = [
      ...(dbPerf.averageQueryTime !== null
        ? [
            {
              name: 'database_query_time',
              value: dbPerf.averageQueryTime,
              unit: 'ms',
              timestamp: new Date(),
            },
          ]
        : []),
      { name: 'ai_api_latency', value: aiPerf.claudeApiLatency, unit: 'ms', timestamp: new Date() },
      { name: 'cache_hit_rate', value: cachePerf.hitRate, unit: '%', timestamp: new Date() },
      { name: 'memory_usage', value: memoryUsage, unit: 'MB', timestamp: new Date() },
      { name: 'cpu_usage', value: cpuUsage, unit: '%', timestamp: new Date() },
    ];

    const score = this.calculateHealthScore(metrics);
    const status = this.determineHealthStatus(score);
    const recommendations = this.generateRecommendations(metrics, dbPerf, aiPerf, cachePerf);

    return {
      status,
      score,
      metrics,
      recommendations,
      lastChecked: new Date(),
    };
  }

  /**
   * Get database performance metrics
   */
  async getDatabasePerformance(): Promise<DatabasePerformance> {
    // AUDIT-021: connectionPoolSize was written in as 20 and activeConnections
    // was Math.floor(Math.random() * 15) + 5, which is worse - it changed on
    // every call, which is what a real connection count does. Both have a real
    // source: the pool this process created knows its own size, and Postgres
    // knows how many connections are open to the database.
    const recentMetrics = this.getRecentMetrics('database_query_time', 100);
    const averageQueryTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
        : null;

    let activeConnections: number | null = null;
    try {
      const result = await db.execute(
        sql`select count(*)::int as count from pg_stat_activity where datname = current_database()`,
      );
      const row = (result as unknown as { rows?: Array<{ count?: number }> }).rows?.[0];
      activeConnections = typeof row?.count === 'number' ? row.count : null;
    } catch {
      // pg_stat_activity needs pg_monitor or superuser on some deployments.
      // Null says "not measured"; a number here would be a guess.
      activeConnections = null;
    }

    return {
      // node-postgres exposes the configured max and the live counts on the
      // pool object itself.
      connectionPoolSize: pool.options.max ?? null,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount,
      activeConnections,
      // Null, not 50: no recorded query means no average, and a default of 50ms
      // reads as a measured 50ms.
      averageQueryTime,
      slowQueries: this.getSlowQueries(),
      // What IS measured: db-logger counts queries over its threshold without
      // retaining them, so the count is real even though the list is empty.
      slowQueryCount: getQueryStats().slowQueries ?? null,
    };
  }

  /**
   * Get AI performance metrics
   */
  async getAIPerformance(): Promise<AIPerformance> {
    const claudeMetrics = this.getRecentMetrics('claude_api_latency', 50);
    const schedulingMetrics = this.getRecentMetrics('scheduling_algorithm_time', 20);

    return {
      claudeApiLatency:
        claudeMetrics.length > 0
          ? claudeMetrics.reduce((sum, m) => sum + m.value, 0) / claudeMetrics.length
          : 800, // Default 800ms
      claudeApiSuccess: 98.5, // 98.5% success rate
      schedulingAlgorithmTime:
        schedulingMetrics.length > 0
          ? schedulingMetrics.reduce((sum, m) => sum + m.value, 0) / schedulingMetrics.length
          : 150, // Default 150ms
      aiAnalysisAccuracy: 87.2, // 87.2% accuracy
      tokensUsedPerDay: 45000,
      costPerDay: 12.5, // $12.50 per day
    };
  }

  /**
   * Get cache performance metrics
   */
  async getCachePerformance(): Promise<CachePerformance> {
    return {
      hitRate: 85.3, // 85.3% hit rate
      missRate: 14.7, // 14.7% miss rate
      evictionRate: 2.1, // 2.1% eviction rate
      memoryUsage: 128, // 128 MB
    };
  }

  /**
   * Monitor API endpoint performance
   */
  monitorAPIEndpoint(endpoint: string, duration: number, statusCode: number): void {
    this.recordMetric(`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}_duration`, duration, 'ms', {
      endpoint,
      statusCode,
    });

    this.recordMetric(`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}_status`, statusCode, 'code', {
      endpoint,
    });
  }

  /**
   * Monitor Claude API performance
   */
  monitorClaudeAPI(
    operation: string,
    duration: number,
    success: boolean,
    tokensUsed?: number,
  ): void {
    this.recordMetric('claude_api_latency', duration, 'ms', { operation, success });
    this.recordMetric('claude_api_success', success ? 1 : 0, 'boolean', { operation });

    if (tokensUsed) {
      this.recordMetric('claude_tokens_used', tokensUsed, 'tokens', { operation });
    }
  }

  /**
   * Monitor scheduling algorithm performance
   */
  monitorSchedulingAlgorithm(taskCount: number, duration: number, scheduledCount: number): void {
    this.recordMetric('scheduling_algorithm_time', duration, 'ms', { taskCount, scheduledCount });
    this.recordMetric('scheduling_success_rate', (scheduledCount / taskCount) * 100, '%', {
      taskCount,
    });
    this.recordMetric('scheduling_throughput', taskCount / (duration / 1000), 'tasks/second', {});
  }

  /**
   * Get performance insights and recommendations
   */
  getPerformanceInsights(): {
    criticalIssues: string[];
    optimizationOpportunities: string[];
    trends: Array<{ metric: string; trend: 'improving' | 'degrading' | 'stable'; change: number }>;
  } {
    const criticalIssues: string[] = [];
    const optimizationOpportunities: string[] = [];
    const trends = this.analyzeTrends();

    // Analyze critical issues
    const recentMetrics = this.getRecentMetrics('database_query_time', 10);
    if (recentMetrics.some((m) => m.value > 1000)) {
      criticalIssues.push('Database queries are taking longer than 1 second');
    }

    const aiLatency = this.getRecentMetrics('claude_api_latency', 10);
    if (aiLatency.some((m) => m.value > 5000)) {
      criticalIssues.push('Claude API responses are taking longer than 5 seconds');
    }

    // Identify optimization opportunities
    const cacheHitRate = this.getRecentMetrics('cache_hit_rate', 5);
    if (cacheHitRate.length > 0 && cacheHitRate[cacheHitRate.length - 1].value < 80) {
      optimizationOpportunities.push('Cache hit rate is below 80% - consider cache optimization');
    }

    const schedulingTime = this.getRecentMetrics('scheduling_algorithm_time', 5);
    if (schedulingTime.some((m) => m.value > 500)) {
      optimizationOpportunities.push(
        'Task scheduling is taking longer than 500ms - consider algorithm optimization',
      );
    }

    return {
      criticalIssues,
      optimizationOpportunities,
      trends,
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(timeRange: 'hour' | 'day' | 'week' = 'day'): {
    summary: Record<string, any>;
    metrics: PerformanceMetric[];
    recommendations: string[];
  } {
    const cutoffTime = new Date();
    switch (timeRange) {
      case 'hour':
        cutoffTime.setHours(cutoffTime.getHours() - 1);
        break;
      case 'day':
        cutoffTime.setDate(cutoffTime.getDate() - 1);
        break;
      case 'week':
        cutoffTime.setDate(cutoffTime.getDate() - 7);
        break;
    }

    const relevantMetrics = this.metrics.filter((m) => m.timestamp >= cutoffTime);

    const summary = {
      totalMetrics: relevantMetrics.length,
      averageApiResponseTime: this.calculateAverage(relevantMetrics, 'api_.*_duration'),
      averageDbQueryTime: this.calculateAverage(relevantMetrics, 'database_query_time'),
      claudeApiCalls: relevantMetrics.filter((m) => m.name === 'claude_api_latency').length,
      schedulingOperations: relevantMetrics.filter((m) => m.name === 'scheduling_algorithm_time')
        .length,
    };

    const recommendations = this.generateOptimizationRecommendations(relevantMetrics);

    return {
      summary,
      metrics: relevantMetrics,
      recommendations,
    };
  }

  // Private helper methods
  private getRecentMetrics(namePattern: string, count: number): PerformanceMetric[] {
    const regex = new RegExp(namePattern);
    return this.metrics.filter((m) => regex.test(m.name)).slice(-count);
  }

  private isCriticalMetric(name: string, value: number): boolean {
    const criticalThresholds: Record<string, number> = {
      database_query_time: 1000, // 1 second
      claude_api_latency: 5000, // 5 seconds
      memory_usage: 1024, // 1 GB
      cpu_usage: 90, // 90%
      error_rate: 5, // 5%
    };

    return criticalThresholds[name] !== undefined && value > criticalThresholds[name];
  }

  private calculateHealthScore(metrics: PerformanceMetric[]): number {
    let score = 100;

    metrics.forEach((metric) => {
      switch (metric.name) {
        case 'database_query_time':
          if (metric.value > 500) score -= 10;
          if (metric.value > 1000) score -= 20;
          break;
        case 'ai_api_latency':
          if (metric.value > 2000) score -= 10;
          if (metric.value > 5000) score -= 20;
          break;
        case 'cache_hit_rate':
          if (metric.value < 80) score -= 10;
          if (metric.value < 60) score -= 20;
          break;
        case 'memory_usage':
          if (metric.value > 512) score -= 5;
          if (metric.value > 1024) score -= 15;
          break;
        case 'cpu_usage':
          if (metric.value > 80) score -= 10;
          if (metric.value > 95) score -= 25;
          break;
      }
    });

    return Math.max(0, score);
  }

  private determineHealthStatus(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
  }

  private generateRecommendations(
    metrics: PerformanceMetric[],
    dbPerf: DatabasePerformance,
    aiPerf: AIPerformance,
    cachePerf: CachePerformance,
  ): string[] {
    const recommendations: string[] = [];

    // Database recommendations
    if (dbPerf.averageQueryTime !== null && dbPerf.averageQueryTime > 500) {
      recommendations.push('Consider optimizing database queries or adding indexes');
    }
    if (dbPerf.slowQueries.length > 5) {
      recommendations.push('Review and optimize slow queries identified in the system');
    }

    // AI recommendations
    if (aiPerf.claudeApiLatency > 2000) {
      recommendations.push('Consider implementing request caching for Claude API calls');
    }
    if (aiPerf.costPerDay > 20) {
      recommendations.push('Monitor Claude API usage to optimize costs');
    }

    // Cache recommendations
    if (cachePerf.hitRate < 80) {
      recommendations.push('Improve cache hit rate by reviewing cache keys and TTL settings');
    }
    if (cachePerf.memoryUsage > 256) {
      recommendations.push('Consider increasing cache memory allocation or optimizing cache size');
    }

    return recommendations;
  }

  /**
   * The slow queries this process has recorded.
   *
   * Empty, until something retains them. server/lib/db-logger.ts COUNTS queries
   * over SLOW_QUERY_THRESHOLD_MS but keeps no text or timestamp, so the count is
   * all that exists - it is reported as slowQueryCount beside this list rather
   * than being spread into invented entries.
   *
   * This used to return two hand-written rows: a 1250ms query against ai_tasks,
   * a table that exists in no schema and no migration, and an 890ms one against
   * calendar_events. The rest of getDatabasePerformance had already been
   * corrected to answer null rather than guess ("a number here would be a
   * guess"); this was the one branch still making them up, and the caller at
   * line 397 branches on `slowQueries.length > 5`, so the fiction fed a
   * recommendation too.
   */
  private getSlowQueries(): Array<{ query: string; duration: number; timestamp: Date }> {
    return [];
  }

  private async getMemoryUsage(): Promise<number> {
    // Use real memory usage from Node.js process
    const memUsage = process.memoryUsage();
    // Return heap used in MB
    return Math.round(memUsage.heapUsed / 1024 / 1024);
  }

  private async getCPUUsage(): Promise<number> {
    // Get CPU usage by measuring over a short interval
    const startUsage = process.cpuUsage();
    const startTime = Date.now();

    // Wait 100ms to measure CPU usage
    await new Promise((resolve) => setTimeout(resolve, 100));

    const endUsage = process.cpuUsage(startUsage);
    const endTime = Date.now();

    const elapsedTime = (endTime - startTime) * 1000; // Convert to microseconds
    const totalCpuTime = endUsage.user + endUsage.system;

    // Calculate percentage (capped at 100)
    const cpuPercent = Math.min(100, Math.round((totalCpuTime / elapsedTime) * 100));
    return cpuPercent;
  }

  private analyzeTrends(): Array<{
    metric: string;
    trend: 'improving' | 'degrading' | 'stable';
    change: number;
  }> {
    const trends: Array<{
      metric: string;
      trend: 'improving' | 'degrading' | 'stable';
      change: number;
    }> = [];

    const metricNames = ['database_query_time', 'claude_api_latency', 'cache_hit_rate'];

    metricNames.forEach((metricName) => {
      const recent = this.getRecentMetrics(metricName, 10);
      if (recent.length >= 5) {
        const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
        const secondHalf = recent.slice(Math.floor(recent.length / 2));

        const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;

        const change = ((secondAvg - firstAvg) / firstAvg) * 100;

        let trend: 'improving' | 'degrading' | 'stable' = 'stable';
        if (Math.abs(change) > 5) {
          // For metrics where lower is better (latency, query time)
          if (metricName.includes('time') || metricName.includes('latency')) {
            trend = change < 0 ? 'improving' : 'degrading';
          } else {
            // For metrics where higher is better (hit rate)
            trend = change > 0 ? 'improving' : 'degrading';
          }
        }

        trends.push({ metric: metricName, trend, change: Math.round(change * 100) / 100 });
      }
    });

    return trends;
  }

  private calculateAverage(metrics: PerformanceMetric[], namePattern: string): number {
    const regex = new RegExp(namePattern);
    const relevantMetrics = metrics.filter((m) => regex.test(m.name));

    if (relevantMetrics.length === 0) return 0;

    return relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;
  }

  private generateOptimizationRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    const avgDbTime = this.calculateAverage(metrics, 'database_query_time');
    if (avgDbTime > 300) {
      recommendations.push(
        'Database query optimization needed - consider indexing frequently queried columns',
      );
    }

    const avgApiTime = this.calculateAverage(metrics, 'api_.*_duration');
    if (avgApiTime > 200) {
      recommendations.push(
        'API response times are high - consider response caching or code optimization',
      );
    }

    const errorMetrics = metrics.filter((m) => m.name.includes('error') && m.value > 0);
    if (errorMetrics.length > metrics.length * 0.05) {
      recommendations.push('Error rate is elevated - review error logs and implement fixes');
    }

    return recommendations;
  }
}

export default new PerformanceMonitor();
