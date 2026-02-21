import 'dotenv/config';
import pg from 'pg';
import { createModuleLogger, getRequestContext } from './lib/logger';
import { config } from './config';
const log = createModuleLogger('db');

const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { drizzleLogger } from './lib/db-logger';
import {
  CircuitBreaker,
  RetryWithBackoff,
  getCircuitBreaker,
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
} from './lib/connection-resilience';

// Build DATABASE_URL from individual components if not provided
function buildDatabaseUrl(): string {
  // If DATABASE_URL is already a proper postgres:// URL, use it
  if (process.env.DATABASE_URL?.startsWith('postgres')) {
    return process.env.DATABASE_URL;
  }

  // Otherwise, build from individual components
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'postgres';

  if (!host || !user || !password) {
    throw new Error(
      'Database configuration incomplete. Provide either DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD',
    );
  }

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

// Build the database URL from environment variables
const databaseUrl = buildDatabaseUrl();
log.info('[Database] Connecting to PostgreSQL...');

// Database connection configuration
interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
  min?: number;
}

// Build pool configuration with resilience settings
const poolConfig: DatabaseConfig = {
  connectionString: databaseUrl,
  // Connection timeout
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT_MS || String(config.database.connectionTimeoutMs),
    10,
  ),
  // Idle timeout
  idleTimeoutMillis: parseInt(
    process.env.DB_IDLE_TIMEOUT_MS || String(config.database.idleTimeoutMs),
    10,
  ),
  // Connection pool limits
  max: parseInt(process.env.DB_POOL_MAX || String(config.database.poolMax), 10),
  min: parseInt(process.env.DB_POOL_MIN || String(config.database.poolMin), 10),
};

// SSL configuration for self-hosted Supabase
// Use ssl: false for local/self-hosted instances, or configure properly for production
if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') {
  // For self-signed certs, use rejectUnauthorized: false
  // For proper SSL, remove rejectUnauthorized or set to true
  (poolConfig as any).ssl =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : true;
}

// Circuit breaker for database connections
const dbCircuitBreaker = getCircuitBreaker('database', {
  failureThreshold: parseInt(
    process.env.DB_CIRCUIT_FAILURE_THRESHOLD ||
      String(config.database.circuitBreakerFailureThreshold),
    10,
  ),
  recoveryTimeout: parseInt(
    process.env.DB_CIRCUIT_RECOVERY_TIMEOUT_MS ||
      String(config.database.circuitBreakerRecoveryTimeoutMs),
    10,
  ),
  halfOpenRequests: parseInt(
    process.env.DB_CIRCUIT_HALF_OPEN_REQUESTS ||
      String(config.database.circuitBreakerHalfOpenRequests),
    10,
  ),
  monitoringWindow: parseInt(
    process.env.DB_CIRCUIT_MONITORING_WINDOW_MS ||
      String(config.database.circuitBreakerMonitoringWindowMs),
    10,
  ),
});

// Retry configuration for database operations
const dbRetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  maxRetries: parseInt(process.env.DB_MAX_RETRIES || String(config.database.maxRetries), 10),
  baseDelayMs: parseInt(
    process.env.DB_RETRY_BASE_DELAY_MS || String(config.database.retryBaseDelayMs),
    10,
  ),
  maxDelayMs: parseInt(
    process.env.DB_RETRY_MAX_DELAY_MS || String(config.database.retryMaxDelayMs),
    10,
  ),
  jitterFactor: parseFloat(
    process.env.DB_RETRY_JITTER_FACTOR || String(config.database.retryJitterFactor),
  ),
};

// Create the retry handler
const dbRetryHandler = new RetryWithBackoff(dbRetryConfig, dbCircuitBreaker);

// Create the connection pool
export const pool = new Pool(poolConfig);

// Listen for pool errors
pool.on('error', (err: Error) => {
  log.error('[Database] Unexpected pool error:', err);
  dbCircuitBreaker.recordFailure();
});

// Inject request correlation ID as SQL comment into every query
// This makes requestId visible in PostgreSQL slow query logs (log_min_duration_statement)
pool.on('connect', (client: pg.PoolClient) => {
  const origQuery = client.query;
  client.query = function (...args: any[]) {
    try {
      const ctx = getRequestContext();
      if (ctx?.requestId) {
        const comment = `/* req:${ctx.requestId} */`;
        if (typeof args[0] === 'string') {
          args[0] = `${comment} ${args[0]}`;
        } else if (args[0] && typeof args[0] === 'object' && args[0].text) {
          args[0] = { ...args[0], text: `${comment} ${args[0].text}` };
        }
      }
    } catch {
      /* never break queries for correlation logging */
    }
    return origQuery.apply(this, args);
  } as any;
});

// Enable query logging based on environment configuration
const enableQueryLogging = process.env.DB_LOG_QUERIES !== 'false';

// Create the Drizzle ORM instance
export const db = drizzle({
  client: pool,
  schema,
  logger: enableQueryLogging ? drizzleLogger : undefined,
});

/**
 * Execute a database query with retry logic and circuit breaker
 *
 * @param queryFn - The query function to execute
 * @param operationName - Name for logging/tracking
 * @returns Query result
 */
export async function withDbResilience<T>(
  queryFn: () => Promise<T>,
  operationName = 'database query',
): Promise<T> {
  return dbRetryHandler.execute(queryFn, { operationName });
}

/**
 * Execute a database transaction with retry logic
 *
 * Note: Transactions should only retry on connection errors,
 * not on query errors that might indicate data issues.
 *
 * @param txFn - Transaction function
 * @param operationName - Name for logging/tracking
 * @returns Transaction result
 */
export async function withDbTransaction<T>(
  txFn: (tx: typeof db) => Promise<T>,
  operationName = 'database transaction',
): Promise<T> {
  return dbRetryHandler.execute(
    async () => {
      // @ts-ignore - Drizzle transaction API
      return db.transaction(txFn);
    },
    { operationName },
  );
}

/**
 * Test database connection with resilience
 */
export async function testConnection(): Promise<{
  connected: boolean;
  circuitState: string;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Simple query to test connection
    await pool.query('SELECT 1 as healthcheck');
    dbCircuitBreaker.recordSuccess();

    return {
      connected: true,
      circuitState: dbCircuitBreaker.getState(),
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    dbCircuitBreaker.recordFailure();

    return {
      connected: false,
      circuitState: dbCircuitBreaker.getState(),
      latencyMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Get database health status
 */
export function getDbHealth(): {
  circuitState: string;
  stats: ReturnType<CircuitBreaker['getStats']>;
  poolStats: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
} {
  return {
    circuitState: dbCircuitBreaker.getState(),
    stats: dbCircuitBreaker.getStats(),
    poolStats: {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    },
  };
}

/**
 * Gracefully close database connections
 */
export async function closeDbConnections(): Promise<void> {
  try {
    await pool.end();
    log.info('[Database] Connection pool closed');
  } catch (error) {
    log.error('[Database] Error closing connection pool:', error);
    throw error;
  }
}

/**
 * Force reconnection (useful for recovering from stale connections)
 */
export async function reconnectDb(): Promise<void> {
  log.info('[Database] Forcing reconnection...');

  try {
    // End current pool connections
    await pool.end();
  } catch (error) {
    log.warn('[Database] Error during pool cleanup:', error);
  }

  // Reset circuit breaker
  dbCircuitBreaker.reset();

  // Note: The pool will recreate connections on next query
  log.info('[Database] Reconnection initiated, pool will recreate connections on next query');
}

// Export circuit breaker for external monitoring
export { dbCircuitBreaker };

// Health check endpoint data
export interface DbHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  circuitState: string;
  latencyMs: number;
  pool: {
    total: number;
    idle: number;
    waiting: number;
  };
  error?: string;
}

/**
 * Comprehensive database health check for health endpoints
 */
export async function performDbHealthCheck(): Promise<DbHealthCheck> {
  const connectionTest = await testConnection();
  const health = getDbHealth();

  let status: 'healthy' | 'degraded' | 'unhealthy';

  if (!connectionTest.connected) {
    status = 'unhealthy';
  } else if (health.circuitState === 'HALF_OPEN' || connectionTest.latencyMs > 5000) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return {
    status,
    connected: connectionTest.connected,
    circuitState: health.circuitState,
    latencyMs: connectionTest.latencyMs,
    pool: {
      total: health.poolStats.totalCount,
      idle: health.poolStats.idleCount,
      waiting: health.poolStats.waitingCount,
    },
    error: connectionTest.error,
  };
}
