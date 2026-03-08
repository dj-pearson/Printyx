/**
 * Environment Validation Module
 *
 * Validates required environment variables at startup to catch
 * configuration issues early rather than at runtime.
 *
 * Usage:
 *   import { validateEnvironment } from './lib/env-validation';
 *   validateEnvironment(); // Called in server startup
 */

import { z } from 'zod';
import { createModuleLogger } from './logger';
const log = createModuleLogger('env-validation');

// Environment variable schema - validates ALL required and optional variables
const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connectivity'),
  DB_HOST: z.string().optional(), // Fallback if DATABASE_URL not set
  DB_PORT: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_SSL: z.string().optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z.string().optional(),

  // Database pool tuning
  DB_POOL_MIN: z.string().optional(), // Min connections (default: 2)
  DB_POOL_MAX: z.string().optional(), // Max connections (default: 20)
  DB_CONNECTION_TIMEOUT_MS: z.string().optional(), // Connection timeout (default: 10000)
  DB_IDLE_TIMEOUT_MS: z.string().optional(), // Idle timeout (default: 30000)
  DB_MAX_RETRIES: z.string().optional(), // Max retries (default: 5)
  DB_RETRY_BASE_DELAY_MS: z.string().optional(), // Retry base delay (default: 1000)
  DB_RETRY_MAX_DELAY_MS: z.string().optional(), // Retry max delay (default: 30000)
  DB_RETRY_JITTER_FACTOR: z.string().optional(), // Jitter factor (default: 0.3)
  DB_CIRCUIT_FAILURE_THRESHOLD: z.string().optional(), // Circuit breaker threshold (default: 5)
  DB_CIRCUIT_RECOVERY_TIMEOUT_MS: z.string().optional(), // Recovery timeout (default: 30000)
  DB_SLOW_QUERY_THRESHOLD_MS: z.string().optional(), // Slow query alert (default: 1000)
  DB_LOG_QUERIES: z.string().optional(), // Log all queries (default: false)
  DB_LOG_PARAMS: z.string().optional(), // Log query params (default: false)

  // Session (required in production)
  SESSION_SECRET: z.string().optional(),

  // Server
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.string().default('5000'),

  // Supabase (required for auth)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Stripe (optional but recommended for billing)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // AI Services (optional)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.enum(['sendgrid', 'aws-ses', 'resend', 'simulation']).optional(),
  EMAIL_ENABLED: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Logging and monitoring
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).optional(),
  LOG_TRANSPORT: z.string().optional(), // console, cloudwatch, elasticsearch, splunk, file, http
  APP_NAME: z.string().optional(),
  APP_VERSION: z.string().optional(),
  APM_PROVIDER: z.string().optional(), // sentry, datadog, newrelic, none
  APM_TRACES_SAMPLE_RATE: z.string().optional(), // 0.0-1.0
  APM_PROFILES_SAMPLE_RATE: z.string().optional(), // 0.0-1.0
  SENTRY_DSN: z.string().optional(),

  // Redis (optional)
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z.string().optional(),

  // Rate limiting
  API_KEY_DEFAULT_RATE_LIMIT_MINUTE: z.string().optional(), // Default: 1000
  API_KEY_DEFAULT_RATE_LIMIT_HOUR: z.string().optional(), // Default: 10000
  API_KEY_DEFAULT_RATE_LIMIT_DAY: z.string().optional(), // Default: 100000

  // Cache
  CACHE_DEFAULT_TTL: z.string().optional(), // Default TTL in seconds (default: 300)

  // CORS
  CORS_ADDITIONAL_ORIGINS: z.string().optional(), // Comma-separated additional origins

  // Backup
  BACKUP_GCS_BUCKET: z.string().optional(), // GCS bucket for backups (default: printyx-backups)
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(), // GCS auth key path

  // Feature flags
  DISABLE_SUBSCRIPTION_JOBS: z.string().optional(), // Disable subscription cron jobs

  // Test Mode (only valid in dev/test)
  TEST_MODE: z.string().optional(),
  TEST_AUTH_SECRET: z.string().optional(),
  DEMO_TENANT_ID: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: Partial<EnvConfig>;
}

/**
 * Validate environment variables at startup
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Parse environment with Zod
  const parseResult = envSchema.safeParse(process.env);

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  const config = parseResult.success ? parseResult.data : {};

  // Production-specific checks
  if (isProduction) {
    // SESSION_SECRET is critical in production
    if (!process.env.SESSION_SECRET) {
      errors.push('SESSION_SECRET: Required in production for secure sessions');
    } else if (process.env.SESSION_SECRET.length < 32) {
      warnings.push('SESSION_SECRET: Should be at least 32 characters for security');
    }

    // Supabase required for auth in production
    if (!process.env.SUPABASE_URL) {
      errors.push('SUPABASE_URL: Required in production for authentication');
    }
    if (!process.env.SUPABASE_ANON_KEY) {
      errors.push('SUPABASE_ANON_KEY: Required in production for authentication');
    }
    if (!process.env.SUPABASE_JWT_SECRET) {
      errors.push('SUPABASE_JWT_SECRET: Required in production for JWT verification');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY: Recommended for server-side auth operations');
    }

    // Stripe for billing
    if (!process.env.STRIPE_SECRET_KEY) {
      warnings.push('STRIPE_SECRET_KEY: Required for payment processing');
    } else {
      // Reject test keys in production (LAUNCH-016)
      if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
        errors.push('STRIPE_SECRET_KEY: Test key (sk_test_*) detected in production. Use a live key (sk_live_*)');
      }
      // Require webhook secret when Stripe is configured (LAUNCH-014)
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        errors.push('STRIPE_WEBHOOK_SECRET: Required in production when STRIPE_SECRET_KEY is set');
      } else if (process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_test_')) {
        warnings.push('STRIPE_WEBHOOK_SECRET: Test webhook secret detected. Verify this is correct for production');
      }
    }
    if (process.env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) {
      errors.push('STRIPE_PUBLISHABLE_KEY: Test key (pk_test_*) detected in production. Use a live key (pk_live_*)');
    }

    // Email provider must not be simulation in production (LAUNCH-003)
    if (!process.env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDER === 'simulation') {
      warnings.push('EMAIL_PROVIDER: Set to a real provider (sendgrid, aws-ses, resend) for production email delivery');
    }
    if (process.env.EMAIL_ENABLED !== 'true') {
      warnings.push('EMAIL_ENABLED: Not set to "true". Transactional emails (welcome, password reset) will not be sent');
    }

    // Sentry DSN for error tracking (LAUNCH-009)
    if (!process.env.SENTRY_DSN) {
      warnings.push('SENTRY_DSN: Recommended for production error tracking');
    }

    // Test mode should not be enabled in production
    if (process.env.TEST_MODE === 'true') {
      errors.push('TEST_MODE: Must not be enabled in production (security risk)');
    }
  }

  // Development warnings
  if (!isProduction) {
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL: Required for database connectivity');
    }

    if (!process.env.SESSION_SECRET) {
      warnings.push(
        'SESSION_SECRET: Not set. Using random secret (sessions will not persist across restarts)',
      );
    }
  }

  // Common recommendations
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY/OPENAI_API_KEY: At least one is recommended for AI features');
  }

  // Validate numeric env vars are actually numbers
  const numericVars = [
    'DB_POOL_MIN',
    'DB_POOL_MAX',
    'DB_CONNECTION_TIMEOUT_MS',
    'DB_IDLE_TIMEOUT_MS',
    'DB_MAX_RETRIES',
    'DB_RETRY_BASE_DELAY_MS',
    'DB_RETRY_MAX_DELAY_MS',
    'DB_CIRCUIT_FAILURE_THRESHOLD',
    'DB_CIRCUIT_RECOVERY_TIMEOUT_MS',
    'DB_SLOW_QUERY_THRESHOLD_MS',
    'CACHE_DEFAULT_TTL',
    'API_KEY_DEFAULT_RATE_LIMIT_MINUTE',
    'API_KEY_DEFAULT_RATE_LIMIT_HOUR',
    'API_KEY_DEFAULT_RATE_LIMIT_DAY',
  ];
  for (const varName of numericVars) {
    const val = process.env[varName];
    if (val !== undefined && isNaN(Number(val))) {
      errors.push(`${varName}: Must be a valid number, got "${val}"`);
    }
  }

  // Validate float vars
  const floatVars = [
    'DB_RETRY_JITTER_FACTOR',
    'APM_TRACES_SAMPLE_RATE',
    'APM_PROFILES_SAMPLE_RATE',
  ];
  for (const varName of floatVars) {
    const val = process.env[varName];
    if (val !== undefined) {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 1) {
        errors.push(`${varName}: Must be a number between 0 and 1, got "${val}"`);
      }
    }
  }

  // Validate LOG_LEVEL if set
  if (process.env.LOG_LEVEL) {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];
    if (!validLevels.includes(process.env.LOG_LEVEL)) {
      warnings.push(
        `LOG_LEVEL: Invalid value "${process.env.LOG_LEVEL}". Valid: ${validLevels.join(', ')}`,
      );
    }
  }

  // Redis recommendation
  if (isProduction && !process.env.REDIS_URL && process.env.REDIS_ENABLED !== 'true') {
    warnings.push('REDIS_URL: Redis is recommended in production for caching and rate limiting');
  }

  // Backup configuration check
  if (isProduction && !process.env.BACKUP_GCS_BUCKET) {
    warnings.push('BACKUP_GCS_BUCKET: Configure for automated database backups');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * Validate environment and fail fast if critical errors
 */
export function validateEnvironmentOrFail(): EnvConfig {
  const result = validateEnvironment();

  // Log warnings
  for (const warning of result.warnings) {
    log.warn(`[ENV WARNING] ${warning}`);
  }

  // Fail on errors
  if (!result.valid) {
    log.error('\n========================================');
    log.error('  ENVIRONMENT CONFIGURATION ERRORS');
    log.error('========================================\n');

    for (const error of result.errors) {
      log.error(`  ❌ ${error}`);
    }

    log.error('\n========================================');
    log.error('  Please fix the above issues and restart');
    log.error('========================================\n');

    // In production, fail immediately
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // In development, just warn but continue
    log.warn('[ENV] Continuing with incomplete configuration (development mode)\n');
  } else {
    log.info('[ENV] ✅ Environment validation passed');
  }

  return result.config as EnvConfig;
}

/**
 * Get a typed environment variable with default
 */
export function getEnv<K extends keyof EnvConfig>(
  key: K,
  defaultValue?: EnvConfig[K],
): EnvConfig[K] | undefined {
  return (process.env[key] as EnvConfig[K]) ?? defaultValue;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
}

/**
 * Check if JWT authentication is properly configured
 */
export interface JwtConfigStatus {
  configured: boolean;
  supabaseUrl: boolean;
  anonKey: boolean;
  jwtSecret: boolean;
  serviceRoleKey: boolean;
  errors: string[];
}

export function checkJwtConfiguration(): JwtConfigStatus {
  const errors: string[] = [];

  const supabaseUrl = !!process.env.SUPABASE_URL;
  const anonKey = !!process.env.SUPABASE_ANON_KEY;
  const jwtSecret = !!process.env.SUPABASE_JWT_SECRET;
  const serviceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    errors.push('SUPABASE_URL is not configured');
  }
  if (!anonKey) {
    errors.push('SUPABASE_ANON_KEY is not configured');
  }
  if (!jwtSecret) {
    errors.push('SUPABASE_JWT_SECRET is not configured - JWT verification will fail');
  }

  const configured = supabaseUrl && anonKey && jwtSecret;

  return {
    configured,
    supabaseUrl,
    anonKey,
    jwtSecret,
    serviceRoleKey,
    errors,
  };
}

/**
 * Log JWT configuration status at startup
 */
export function logJwtConfigurationStatus(): void {
  const status = checkJwtConfiguration();

  if (status.configured) {
    log.info('[JWT] ✅ JWT authentication is properly configured');
  } else {
    log.warn('[JWT] ⚠️  JWT authentication is NOT fully configured:');
    status.errors.forEach((error) => log.warn(`  - ${error}`));

    if (isProduction()) {
      log.error('[JWT] ❌ CRITICAL: JWT must be configured in production!');
    } else {
      log.warn('[JWT] Running in development mode - some auth features may not work');
    }
  }
}

export default {
  validateEnvironment,
  validateEnvironmentOrFail,
  getEnv,
  isProduction,
  isDevelopment,
  isTestMode,
  checkJwtConfiguration,
  logJwtConfigurationStatus,
};
