/**
 * Connection Resilience Tests
 *
 * Tests for exponential backoff and circuit breaker functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  RetryWithBackoff,
  calculateBackoffDelay,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitOpenError,
} from '../../lib/connection-resilience';

describe('Connection Resilience', () => {
  describe('calculateBackoffDelay', () => {
    it('should calculate exponential delay', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        jitterFactor: 0, // Disable jitter for predictable testing
      };

      expect(calculateBackoffDelay(0, config)).toBe(1000); // 1000 * 2^0
      expect(calculateBackoffDelay(1, config)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoffDelay(2, config)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoffDelay(3, config)).toBe(8000); // 1000 * 2^3
    });

    it('should cap delay at maxDelayMs', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        jitterFactor: 0,
        maxDelayMs: 5000,
      };

      expect(calculateBackoffDelay(10, config)).toBe(5000);
    });

    it('should add jitter within expected range', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        jitterFactor: 0.3,
      };

      const delays = Array.from({ length: 100 }, () => calculateBackoffDelay(0, config));

      // All delays should be within 30% of base delay
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(700);
        expect(delay).toBeLessThanOrEqual(1300);
      });
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable connection errors', () => {
      expect(isRetryableError({ code: 'ECONNREFUSED' }, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableError({ code: 'ETIMEDOUT' }, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableError({ code: 'ECONNRESET' }, DEFAULT_RETRY_CONFIG)).toBe(true);
    });

    it('should identify retryable PostgreSQL errors', () => {
      expect(isRetryableError({ code: '08006' }, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableError({ message: 'connection does not exist' }, DEFAULT_RETRY_CONFIG)).toBe(
        true,
      );
    });

    it('should identify rate limiting errors', () => {
      expect(isRetryableError({ statusCode: 429 }, DEFAULT_RETRY_CONFIG)).toBe(true);
      expect(isRetryableError({ status: 429 }, DEFAULT_RETRY_CONFIG)).toBe(true);
    });

    it('should not retry non-retryable errors', () => {
      expect(isRetryableError({ code: 'VALIDATION_ERROR' }, DEFAULT_RETRY_CONFIG)).toBe(false);
      expect(isRetryableError({ statusCode: 400 }, DEFAULT_RETRY_CONFIG)).toBe(false);
      expect(isRetryableError({ statusCode: 500 }, DEFAULT_RETRY_CONFIG)).toBe(false);
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test', {
        failureThreshold: 3,
        recoveryTimeout: 1000,
        halfOpenRequests: 2,
        monitoringWindow: 5000,
      });
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should transition to OPEN after threshold failures', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Trip the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should now be able to execute
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });

    it('should close circuit after successful requests in HALF_OPEN', async () => {
      // Trip and wait for HALF_OPEN
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Successful requests in HALF_OPEN
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should reopen circuit on failure in HALF_OPEN', async () => {
      // Trip and wait for HALF_OPEN
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      circuitBreaker.canExecute(); // Transition to HALF_OPEN

      // Failure in HALF_OPEN
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should track statistics correctly', () => {
      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();
      circuitBreaker.recordFailure();

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(1);
      expect(stats.state).toBe('CLOSED');
    });

    it('should emit state change events', () => {
      const stateChanges: any[] = [];
      circuitBreaker.on('stateChange', (event) => {
        stateChanges.push(event);
      });

      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].from).toBe('CLOSED');
      expect(stateChanges[0].to).toBe('OPEN');
    });

    it('should reset correctly', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');

      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.getStats().failures).toBe(0);
    });
  });

  describe('RetryWithBackoff', () => {
    it('should succeed without retries', async () => {
      const retryHandler = new RetryWithBackoff({ maxRetries: 3 });
      let callCount = 0;

      const result = await retryHandler.execute(async () => {
        callCount++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(callCount).toBe(1);
    });

    it('should retry on retryable errors', async () => {
      const retryHandler = new RetryWithBackoff({
        maxRetries: 3,
        baseDelayMs: 10,
        jitterFactor: 0,
      });
      let callCount = 0;

      const result = await retryHandler.execute(async () => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('Connection reset');
          (error as any).code = 'ECONNRESET';
          throw error;
        }
        return 'success';
      });

      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      const retryHandler = new RetryWithBackoff({
        maxRetries: 2,
        baseDelayMs: 10,
        jitterFactor: 0,
      });

      const error = new Error('Connection refused');
      (error as any).code = 'ECONNREFUSED';

      await expect(
        retryHandler.execute(async () => {
          throw error;
        }),
      ).rejects.toThrow('Connection refused');
    });

    it('should not retry non-retryable errors', async () => {
      const retryHandler = new RetryWithBackoff({ maxRetries: 3 });
      let callCount = 0;

      await expect(
        retryHandler.execute(async () => {
          callCount++;
          throw new Error('Validation error');
        }),
      ).rejects.toThrow('Validation error');

      expect(callCount).toBe(1);
    });

    it('should respect circuit breaker', async () => {
      const circuitBreaker = new CircuitBreaker('test', {
        failureThreshold: 1,
        recoveryTimeout: 10000,
        halfOpenRequests: 1,
        monitoringWindow: 5000,
      });

      const retryHandler = new RetryWithBackoff({}, circuitBreaker);

      // Trip the circuit
      circuitBreaker.recordFailure();

      await expect(retryHandler.execute(async () => 'success')).rejects.toThrow(CircuitOpenError);
    });

    it('should call onRetry callback', async () => {
      const retryHandler = new RetryWithBackoff({
        maxRetries: 2,
        baseDelayMs: 10,
        jitterFactor: 0,
      });

      const retryEvents: any[] = [];

      const error = new Error('Timeout');
      (error as any).code = 'ETIMEDOUT';

      let callCount = 0;
      await retryHandler.execute(
        async () => {
          callCount++;
          if (callCount < 3) throw error;
          return 'success';
        },
        {
          onRetry: (err, attempt, delay) => {
            retryEvents.push({ attempt, delay });
          },
        },
      );

      expect(retryEvents).toHaveLength(2);
      expect(retryEvents[0].attempt).toBe(0);
      expect(retryEvents[1].attempt).toBe(1);
    });
  });
});
