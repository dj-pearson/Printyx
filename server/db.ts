import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, NeonDatabase } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { drizzleLogger } from './lib/db-logger';
import {
  CircuitBreaker,
  RetryWithBackoff,
  getCircuitBreaker,
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
} from './lib/connection-resilience';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

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
  connectionString: process.env.DATABASE_URL,
  // Connection timeout (default: 10 seconds)
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
  // Idle timeout (default: 30 seconds)
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  // Connection pool limits
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
};

// Neon automatically uses SSL/TLS, but we ensure it's enforced in production
if (process.env.NODE_ENV === 'production') {
  poolConfig.ssl = true;
}

// Circuit breaker for database connections
const dbCircuitBreaker = getCircuitBreaker('database', {
  failureThreshold: parseInt(process.env.DB_CIRCUIT_FAILURE_THRESHOLD || '5', 10),
  recoveryTimeout: parseInt(process.env.DB_CIRCUIT_RECOVERY_TIMEOUT_MS || '30000', 10),
  halfOpenRequests: parseInt(process.env.DB_CIRCUIT_HALF_OPEN_REQUESTS || '3', 10),
  monitoringWindow: parseInt(process.env.DB_CIRCUIT_MONITORING_WINDOW_MS || '60000', 10),
});

// Retry configuration for database operations
const dbRetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  maxRetries: parseInt(process.env.DB_MAX_RETRIES || '5', 10),
  baseDelayMs: parseInt(process.env.DB_RETRY_BASE_DELAY_MS || '1000', 10),
  maxDelayMs: parseInt(process.env.DB_RETRY_MAX_DELAY_MS || '30000', 10),
  jitterFactor: parseFloat(process.env.DB_RETRY_JITTER_FACTOR || '0.3'),
};

// Create the retry handler
const dbRetryHandler = new RetryWithBackoff(dbRetryConfig, dbCircuitBreaker);

// Create the connection pool
export const pool = new Pool(poolConfig);

// Listen for pool errors
pool.on('error', (err: Error) => {
  console.error('[Database] Unexpected pool error:', err);
  dbCircuitBreaker.recordFailure();
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
  operationName = 'database query'
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
  operationName = 'database transaction'
): Promise<T> {
  return dbRetryHandler.execute(
    async () => {
      // @ts-ignore - Drizzle transaction API
      return db.transaction(txFn);
    },
    { operationName }
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
    console.log('[Database] Connection pool closed');
  } catch (error) {
    console.error('[Database] Error closing connection pool:', error);
    throw error;
  }
}

/**
 * Force reconnection (useful for recovering from stale connections)
 */
export async function reconnectDb(): Promise<void> {
  console.log('[Database] Forcing reconnection...');

  try {
    // End current pool connections
    await pool.end();
  } catch (error) {
    console.warn('[Database] Error during pool cleanup:', error);
  }

  // Reset circuit breaker
  dbCircuitBreaker.reset();

  // Note: The pool will recreate connections on next query
  // For Neon serverless, this is handled automatically
  console.log('[Database] Reconnection initiated, pool will recreate connections on next query');
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
  } else if (
    health.circuitState === 'HALF_OPEN' ||
    connectionTest.latencyMs > 5000
  ) {
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
