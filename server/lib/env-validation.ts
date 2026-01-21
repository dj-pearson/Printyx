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

// Environment variable schema
const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connectivity'),

  // Session (required in production)
  SESSION_SECRET: z.string().optional(),

  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

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
    console.warn(`[ENV WARNING] ${warning}`);
  }

  // Fail on errors
  if (!result.valid) {
    console.error('\n========================================');
    console.error('  ENVIRONMENT CONFIGURATION ERRORS');
    console.error('========================================\n');

    for (const error of result.errors) {
      console.error(`  ❌ ${error}`);
    }

    console.error('\n========================================');
    console.error('  Please fix the above issues and restart');
    console.error('========================================\n');

    // In production, fail immediately
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // In development, just warn but continue
    console.warn('[ENV] Continuing with incomplete configuration (development mode)\n');
  } else {
    console.log('[ENV] ✅ Environment validation passed');
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
    console.log('[JWT] ✅ JWT authentication is properly configured');
  } else {
    console.warn('[JWT] ⚠️  JWT authentication is NOT fully configured:');
    status.errors.forEach((error) => console.warn(`  - ${error}`));

    if (isProduction()) {
      console.error('[JWT] ❌ CRITICAL: JWT must be configured in production!');
    } else {
      console.warn('[JWT] Running in development mode - some auth features may not work');
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
