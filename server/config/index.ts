/**
 * Configuration Loader
 * US-033: Environment-specific configuration management
 *
 * Loads and merges configuration in this priority order:
 *   1. default.ts (base defaults)
 *   2. {NODE_ENV}.ts (environment-specific overrides)
 *   3. Environment variable overrides (highest priority)
 *
 * Usage:
 *   import { config } from '../config';
 *   config.database.poolMax  // 20 (or env-specific override)
 *   config.cache.defaultTtl  // 300 (or env-specific override)
 */

import { defaultConfig, type AppConfig } from './default';
import { developmentConfig } from './development';
import { stagingConfig } from './staging';
import { productionConfig } from './production';
import { testConfig } from './test';

/** Utility type for deep partial overrides */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== undefined &&
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as any, sourceVal as any);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

/**
 * Load environment-specific config file.
 */
function loadEnvConfig(env: string): DeepPartial<AppConfig> {
  switch (env) {
    case 'development':
      return developmentConfig;
    case 'staging':
      return stagingConfig;
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return {};
  }
}

/**
 * Apply environment variable overrides to config.
 * Env vars take the highest priority.
 */
function applyEnvOverrides(cfg: AppConfig): AppConfig {
  const env = process.env;

  // Server
  if (env.PORT) cfg.server.port = parseInt(env.PORT, 10);

  // Database pool
  if (env.DB_POOL_MIN) cfg.database.poolMin = parseInt(env.DB_POOL_MIN, 10);
  if (env.DB_POOL_MAX) cfg.database.poolMax = parseInt(env.DB_POOL_MAX, 10);
  if (env.DB_CONNECTION_TIMEOUT_MS)
    cfg.database.connectionTimeoutMs = parseInt(env.DB_CONNECTION_TIMEOUT_MS, 10);
  if (env.DB_IDLE_TIMEOUT_MS) cfg.database.idleTimeoutMs = parseInt(env.DB_IDLE_TIMEOUT_MS, 10);
  if (env.DB_MAX_RETRIES) cfg.database.maxRetries = parseInt(env.DB_MAX_RETRIES, 10);
  if (env.DB_RETRY_BASE_DELAY_MS)
    cfg.database.retryBaseDelayMs = parseInt(env.DB_RETRY_BASE_DELAY_MS, 10);
  if (env.DB_RETRY_MAX_DELAY_MS)
    cfg.database.retryMaxDelayMs = parseInt(env.DB_RETRY_MAX_DELAY_MS, 10);
  if (env.DB_RETRY_JITTER_FACTOR)
    cfg.database.retryJitterFactor = parseFloat(env.DB_RETRY_JITTER_FACTOR);
  if (env.DB_CIRCUIT_FAILURE_THRESHOLD)
    cfg.database.circuitBreakerFailureThreshold = parseInt(env.DB_CIRCUIT_FAILURE_THRESHOLD, 10);
  if (env.DB_CIRCUIT_RECOVERY_TIMEOUT_MS)
    cfg.database.circuitBreakerRecoveryTimeoutMs = parseInt(env.DB_CIRCUIT_RECOVERY_TIMEOUT_MS, 10);
  if (env.DB_CIRCUIT_HALF_OPEN_REQUESTS)
    cfg.database.circuitBreakerHalfOpenRequests = parseInt(env.DB_CIRCUIT_HALF_OPEN_REQUESTS, 10);
  if (env.DB_CIRCUIT_MONITORING_WINDOW_MS)
    cfg.database.circuitBreakerMonitoringWindowMs = parseInt(
      env.DB_CIRCUIT_MONITORING_WINDOW_MS,
      10,
    );
  if (env.DB_SLOW_QUERY_THRESHOLD_MS)
    cfg.database.slowQueryThresholdMs = parseInt(env.DB_SLOW_QUERY_THRESHOLD_MS, 10);
  if (env.DB_LOG_QUERIES) cfg.database.logQueries = env.DB_LOG_QUERIES === 'true';
  if (env.DB_LOG_PARAMS) cfg.database.logParams = env.DB_LOG_PARAMS === 'true';

  // Cache
  if (env.CACHE_DEFAULT_TTL) cfg.cache.defaultTtl = parseInt(env.CACHE_DEFAULT_TTL, 10);

  // Rate limits
  if (env.API_KEY_DEFAULT_RATE_LIMIT_MINUTE)
    cfg.rateLimits.apiKeyPerMinute = parseInt(env.API_KEY_DEFAULT_RATE_LIMIT_MINUTE, 10);
  if (env.API_KEY_DEFAULT_RATE_LIMIT_HOUR)
    cfg.rateLimits.apiKeyPerHour = parseInt(env.API_KEY_DEFAULT_RATE_LIMIT_HOUR, 10);
  if (env.API_KEY_DEFAULT_RATE_LIMIT_DAY)
    cfg.rateLimits.apiKeyPerDay = parseInt(env.API_KEY_DEFAULT_RATE_LIMIT_DAY, 10);

  // Logging
  if (env.LOG_LEVEL) cfg.logging.level = env.LOG_LEVEL as any;
  if (env.LOG_TRANSPORT) cfg.logging.transport = env.LOG_TRANSPORT as any;
  if (env.LOG_BATCH_SIZE) cfg.logging.batchSize = parseInt(env.LOG_BATCH_SIZE, 10);
  if (env.LOG_FLUSH_INTERVAL_MS)
    cfg.logging.flushIntervalMs = parseInt(env.LOG_FLUSH_INTERVAL_MS, 10);

  // APM
  if (env.APM_PROVIDER) cfg.apm.provider = env.APM_PROVIDER as any;
  if (env.APM_TRACES_SAMPLE_RATE) cfg.apm.tracesSampleRate = parseFloat(env.APM_TRACES_SAMPLE_RATE);
  if (env.APM_PROFILES_SAMPLE_RATE)
    cfg.apm.profilesSampleRate = parseFloat(env.APM_PROFILES_SAMPLE_RATE);

  // Features
  if (env.DISABLE_SUBSCRIPTION_JOBS)
    cfg.features.disableSubscriptionJobs = env.DISABLE_SUBSCRIPTION_JOBS === 'true';

  // Backup
  if (env.BACKUP_GCS_BUCKET) cfg.backup.gcsBucket = env.BACKUP_GCS_BUCKET;

  // CORS - additional origins from env
  if (env.CORS_ADDITIONAL_ORIGINS) {
    const additional = env.CORS_ADDITIONAL_ORIGINS.split(',').map((s) => s.trim());
    cfg.cors.productionOrigins = [...cfg.cors.productionOrigins, ...additional];
  }

  return cfg;
}

/**
 * Build the final configuration by merging layers.
 */
function buildConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // 1. Start with defaults
  let cfg = { ...defaultConfig };

  // 2. Merge environment-specific overrides
  const envConfig = loadEnvConfig(nodeEnv);
  cfg = deepMerge(cfg, envConfig);

  // 3. Apply environment variable overrides (highest priority)
  cfg = applyEnvOverrides(cfg);

  return cfg;
}

/** The resolved application configuration */
export const config: AppConfig = buildConfig();

export default config;
