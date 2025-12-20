/**
 * Connection Resilience Module
 *
 * Provides exponential backoff retry logic and circuit breaker pattern
 * for database connections and external service calls.
 */

import { EventEmitter } from 'events';

// Configuration interfaces
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenRequests: number;
  monitoringWindow: number;
}

export interface ResilienceConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
}

// Default configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
  retryableErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'PROTOCOL_CONNECTION_LOST',
    'CONNECTION_ERROR',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'socket hang up',
    'getaddrinfo',
    '57P01', // PostgreSQL: admin shutdown
    '57P02', // PostgreSQL: crash shutdown
    '57P03', // PostgreSQL: cannot connect now
    '08000', // PostgreSQL: connection exception
    '08003', // PostgreSQL: connection does not exist
    '08006', // PostgreSQL: connection failure
  ],
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenRequests: 3,
  monitoringWindow: 60000,
};

// Circuit breaker states
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  lastStateChange: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  return Math.round(cappedDelay + jitter);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any, config: RetryConfig): boolean {
  if (!error) return false;

  const errorCode = error.code || error.errno || '';
  const errorMessage = error.message || '';

  // Check against retryable error patterns
  for (const pattern of config.retryableErrors || []) {
    if (
      errorCode.includes(pattern) ||
      errorMessage.includes(pattern)
    ) {
      return true;
    }
  }

  // Check for specific PostgreSQL connection errors (Class 08 - Connection Exception)
  // https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (error.severity === 'FATAL' && error.code?.startsWith('08')) {
    return true;
  }

  // Check for rate limiting (should retry with backoff)
  if (error.statusCode === 429 || error.status === 429) {
    return true;
  }

  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker Class
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are rejected immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = [];
  private successes: number = 0;
  private halfOpenRequests: number = 0;
  private lastStateChange: Date = new Date();
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private recoveryTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly name: string,
    private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
  ) {
    super();
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.getRecentFailures(),
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get failures within the monitoring window
   */
  private getRecentFailures(): number {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;
    this.failures = this.failures.filter(time => time > windowStart);
    return this.failures.length;
  }

  /**
   * Check if the circuit allows the request
   */
  canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if recovery timeout has passed
        const timeSinceOpen = Date.now() - this.lastStateChange.getTime();
        if (timeSinceOpen >= this.config.recoveryTimeout) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        // Allow limited requests in half-open state
        return this.halfOpenRequests < this.config.halfOpenRequests;

      default:
        return true;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.totalRequests++;
    this.totalSuccesses++;
    this.successes++;
    this.lastSuccess = new Date();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequests++;
      // If we've had enough successes in half-open, close the circuit
      if (this.halfOpenRequests >= this.config.halfOpenRequests) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.totalRequests++;
    this.totalFailures++;
    this.failures.push(Date.now());
    this.lastFailure = new Date();

    if (this.state === 'HALF_OPEN') {
      // Single failure in half-open opens the circuit again
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      // Check if we've exceeded the failure threshold
      if (this.getRecentFailures() >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    // Reset counters on state transition
    if (newState === 'CLOSED') {
      this.failures = [];
      this.successes = 0;
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenRequests = 0;
      this.successes = 0;
    }

    // Clear any existing recovery timer
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    // Set recovery timer if opening
    if (newState === 'OPEN') {
      this.recoveryTimer = setTimeout(() => {
        this.transitionTo('HALF_OPEN');
      }, this.config.recoveryTimeout);
    }

    // Emit state change event
    this.emit('stateChange', {
      name: this.name,
      from: oldState,
      to: newState,
      timestamp: this.lastStateChange,
    });

    console.log(
      `[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`
    );
  }

  /**
   * Force the circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.failures = [];
    this.successes = 0;
    this.halfOpenRequests = 0;
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.transitionTo('CLOSED');
  }

  /**
   * Get the current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }
}

/**
 * Retry with Exponential Backoff
 *
 * Wraps an async operation with retry logic including:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Optional circuit breaker integration
 */
export class RetryWithBackoff<T> {
  private readonly config: RetryConfig;
  private readonly circuitBreaker?: CircuitBreaker;

  constructor(
    config: Partial<RetryConfig> = {},
    circuitBreaker?: CircuitBreaker
  ) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Execute an operation with retry logic
   */
  async execute(
    operation: () => Promise<T>,
    options: {
      operationName?: string;
      onRetry?: (error: Error, attempt: number, delay: number) => void;
    } = {}
  ): Promise<T> {
    const { operationName = 'operation', onRetry } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Check circuit breaker first
      if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
        throw new CircuitOpenError(
          `Circuit breaker is open for ${operationName}`,
          this.circuitBreaker.getStats()
        );
      }

      try {
        const result = await operation();

        // Record success with circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordSuccess();
        }

        if (attempt > 0) {
          console.log(
            `[RetryWithBackoff] ${operationName} succeeded after ${attempt} retries`
          );
        }

        return result;
      } catch (error: any) {
        lastError = error;

        // Record failure with circuit breaker
        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure();
        }

        // Check if error is retryable and we have retries left
        if (
          attempt < this.config.maxRetries &&
          isRetryableError(error, this.config)
        ) {
          const delay = calculateBackoffDelay(attempt, this.config);

          console.warn(
            `[RetryWithBackoff] ${operationName} failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}), ` +
            `retrying in ${delay}ms: ${error.message}`
          );

          if (onRetry) {
            onRetry(error, attempt, delay);
          }

          await sleep(delay);
        } else {
          // Non-retryable error or max retries exceeded
          break;
        }
      }
    }

    // All retries exhausted
    console.error(
      `[RetryWithBackoff] ${operationName} failed after ${this.config.maxRetries + 1} attempts`
    );

    throw lastError;
  }
}

/**
 * Circuit Open Error
 */
export class CircuitOpenError extends Error {
  constructor(
    message: string,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Connection Pool with Resilience
 *
 * Wraps a database connection pool with retry logic and circuit breaker.
 */
export class ResilientConnectionPool<TPool> {
  private readonly retryHandler: RetryWithBackoff<TPool>;
  private pool: TPool | null = null;
  private connecting: Promise<TPool> | null = null;

  constructor(
    private readonly createPool: () => Promise<TPool>,
    private readonly destroyPool: (pool: TPool) => Promise<void>,
    public readonly circuitBreaker: CircuitBreaker,
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.retryHandler = new RetryWithBackoff(
      retryConfig,
      circuitBreaker
    );
  }

  /**
   * Get or create the connection pool
   */
  async getPool(): Promise<TPool> {
    if (this.pool) {
      return this.pool;
    }

    // Prevent concurrent connection attempts
    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.retryHandler.execute(
      async () => {
        const pool = await this.createPool();
        this.pool = pool;
        return pool;
      },
      { operationName: 'database connection' }
    );

    try {
      const pool = await this.connecting;
      return pool;
    } finally {
      this.connecting = null;
    }
  }

  /**
   * Execute a query with resilience
   */
  async execute<TResult>(
    queryFn: (pool: TPool) => Promise<TResult>,
    operationName = 'database query'
  ): Promise<TResult> {
    return this.retryHandler.execute(
      async () => {
        const pool = await this.getPool();
        return queryFn(pool);
      },
      { operationName }
    );
  }

  /**
   * Reconnect (destroy and recreate pool)
   */
  async reconnect(): Promise<TPool> {
    if (this.pool) {
      try {
        await this.destroyPool(this.pool);
      } catch (error) {
        console.warn('[ResilientConnectionPool] Error destroying pool:', error);
      }
      this.pool = null;
    }

    return this.getPool();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    connected: boolean;
    circuitState: CircuitState;
    error?: string;
  }> {
    try {
      await this.getPool();
      return {
        connected: true,
        circuitState: this.circuitBreaker.getState(),
      };
    } catch (error: any) {
      return {
        connected: false,
        circuitState: this.circuitBreaker.getState(),
        error: error.message,
      };
    }
  }
}

/**
 * Create a resilient HTTP/API client wrapper
 */
export function createResilientClient<T extends (...args: any[]) => Promise<any>>(
  client: T,
  circuitBreaker: CircuitBreaker,
  retryConfig: Partial<RetryConfig> = {}
): T {
  const retryHandler = new RetryWithBackoff(retryConfig, circuitBreaker);

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return retryHandler.execute(
      () => client(...args),
      { operationName: 'API call' }
    );
  }) as T;
}

// Global circuit breaker registry
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker by name
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  let breaker = circuitBreakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(
      name,
      { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config }
    );
    circuitBreakers.set(name, breaker);
  }
  return breaker;
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  for (const [name, breaker] of circuitBreakers.entries()) {
    stats[name] = breaker.getStats();
  }
  return stats;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
}

// Default instances for common use cases
export const databaseCircuitBreaker = getCircuitBreaker('database', {
  failureThreshold: 3,
  recoveryTimeout: 15000,
  halfOpenRequests: 2,
});

export const externalApiCircuitBreaker = getCircuitBreaker('external-api', {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenRequests: 3,
});

/**
 * Convenience function for retrying operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    operationName?: string;
    retryConfig?: Partial<RetryConfig>;
    circuitBreaker?: CircuitBreaker;
    onRetry?: (error: Error, attempt: number, delay: number) => void;
  } = {}
): Promise<T> {
  const retryHandler = new RetryWithBackoff(
    options.retryConfig,
    options.circuitBreaker
  );

  return retryHandler.execute(operation, {
    operationName: options.operationName,
    onRetry: options.onRetry,
  });
}

/**
 * Decorator for adding resilience to class methods
 */
export function Resilient(
  circuitBreakerName: string,
  retryConfig?: Partial<RetryConfig>
) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const breaker = getCircuitBreaker(circuitBreakerName);
      return withRetry(
        () => originalMethod.apply(this, args),
        {
          operationName: propertyKey,
          retryConfig,
          circuitBreaker: breaker,
        }
      );
    };

    return descriptor;
  };
}
