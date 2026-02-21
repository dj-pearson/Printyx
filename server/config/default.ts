/**
 * Default Configuration
 * Base configuration shared across all environments.
 * Environment-specific files override these values.
 */

export const defaultConfig = {
  /** Server settings */
  server: {
    port: 5000,
    bodyLimitMb: 10,
    trustProxy: false,
  },

  /** Database connection pool */
  database: {
    poolMin: 2,
    poolMax: 20,
    connectionTimeoutMs: 10000,
    idleTimeoutMs: 30000,
    maxRetries: 5,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 30000,
    retryJitterFactor: 0.3,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerRecoveryTimeoutMs: 30000,
    circuitBreakerHalfOpenRequests: 3,
    circuitBreakerMonitoringWindowMs: 60000,
    slowQueryThresholdMs: 1000,
    logQueries: false,
    logParams: false,
  },

  /** Cache TTLs (in seconds) */
  cache: {
    defaultTtl: 300, // 5 minutes
    shortTtl: 60, // 1 minute
    mediumTtl: 300, // 5 minutes
    longTtl: 3600, // 1 hour
    rbacCacheTtlMs: 15 * 60 * 1000, // 15 minutes
    rbacServiceCacheTtlSeconds: 1800, // 30 minutes
    ipWhitelistCacheTtlMs: 5 * 60 * 1000, // 5 minutes
  },

  /** Rate limiting defaults */
  rateLimits: {
    auth: { limit: 5, windowMs: 60 * 1000 },
    billing: { limit: 20, windowMs: 60 * 1000 },
    mutation: { limit: 100, windowMs: 60 * 1000 },
    read: { limit: 200, windowMs: 60 * 1000 },
    general: { limit: 500, windowMs: 15 * 60 * 1000 },
    search: { limit: 300, windowMs: 15 * 60 * 1000 },
    export: { limit: 20, windowMs: 60 * 60 * 1000 },
    ai: { limit: 50, windowMs: 60 * 60 * 1000 },
    bulk: { limit: 10, windowMs: 60 * 60 * 1000 },
    reports: { limit: 100, windowMs: 60 * 60 * 1000 },
    apiKeyPerMinute: 1000,
    apiKeyPerHour: 10000,
    apiKeyPerDay: 100000,
  },

  /** Pagination defaults */
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  /** Logging */
  logging: {
    level: 'info' as const,
    transport: 'console' as const,
    batchSize: 100,
    flushIntervalMs: 5000,
    maxRetries: 3,
    retryDelayMs: 1000,
    fileSplunkPort: 8088,
    fileMaxSizeBytes: 10 * 1024 * 1024, // 10MB
    fileMaxCount: 5,
  },

  /** APM / Monitoring */
  apm: {
    provider: 'none' as const,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
  },

  /** CORS origins */
  cors: {
    productionOrigins: ['https://printyx.net', 'https://api.printyx.net'] as string[],
    productionPatterns: ['^https?:\\/\\/([a-z0-9-]+\\.)?printyx\\.net$'] as string[],
    devOrigins: [
      'http://localhost:5000',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:3000',
    ] as string[],
    devPatterns: ['^https:\\/\\/.*\\.replit\\.dev$'] as string[],
  },

  /** Feature toggles */
  features: {
    enableAi: true,
    enableStripe: true,
    enableWebSockets: true,
    enableEmailNotifications: true,
    enableScheduledReports: true,
    enableBulkOperations: true,
    disableSubscriptionJobs: false,
  },

  /** Session / Auth */
  session: {
    cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    secureCookies: false,
  },

  /** Backup configuration */
  backup: {
    gcsBucket: 'printyx-backups',
    retentionDaily: 7,
    retentionWeekly: 4,
    retentionMonthly: 12,
    cronSchedule: '0 2 * * *', // 2 AM UTC
  },
};

export type AppConfig = typeof defaultConfig;
