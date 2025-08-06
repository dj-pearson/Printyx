/**
 * Error Monitoring and Retry Logic for Integrations
 * Handles integration failures, implements exponential backoff, and provides monitoring
 */
import { db } from '../db';
import { systemIntegrations } from '../../shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface IntegrationError {
  id: string;
  integrationId: string;
  tenantId: string;
  provider: string;
  operation: string;
  errorType: 'auth' | 'rate_limit' | 'timeout' | 'api_error' | 'network' | 'validation' | 'unknown';
  errorMessage: string;
  errorCode?: string;
  httpStatus?: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  resolved: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialFactor: number;
  jitterMs: number;
}

export interface IntegrationHealth {
  integrationId: string;
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';
  uptime: number;
  errorRate: number;
  lastError?: Date;
  lastSuccess?: Date;
  responseTime: number;
  errorCount: number;
  successCount: number;
}

export class ErrorMonitor {
  private static errors: Map<string, IntegrationError> = new Map();
  private static retryQueue: Map<string, NodeJS.Timeout> = new Map();

  // Default retry policies for different error types
  private static retryPolicies: Record<string, RetryPolicy> = {
    auth: {
      maxRetries: 3,
      baseDelayMs: 5000,
      maxDelayMs: 300000, // 5 minutes
      exponentialFactor: 2,
      jitterMs: 1000
    },
    rate_limit: {
      maxRetries: 5,
      baseDelayMs: 60000, // 1 minute
      maxDelayMs: 3600000, // 1 hour
      exponentialFactor: 2,
      jitterMs: 5000
    },
    timeout: {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 60000, // 1 minute
      exponentialFactor: 1.5,
      jitterMs: 500
    },
    network: {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 120000, // 2 minutes
      exponentialFactor: 2,
      jitterMs: 200
    },
    api_error: {
      maxRetries: 2,
      baseDelayMs: 10000,
      maxDelayMs: 600000, // 10 minutes
      exponentialFactor: 3,
      jitterMs: 2000
    },
    validation: {
      maxRetries: 1,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      exponentialFactor: 1,
      jitterMs: 0
    },
    unknown: {
      maxRetries: 2,
      baseDelayMs: 5000,
      maxDelayMs: 300000, // 5 minutes
      exponentialFactor: 2,
      jitterMs: 1000
    }
  };

  /**
   * Record an integration error
   */
  static async recordError(
    integrationId: string,
    tenantId: string,
    provider: string,
    operation: string,
    error: Error,
    metadata?: any
  ): Promise<string> {
    const errorType = this.classifyError(error);
    const policy = this.retryPolicies[errorType];
    
    const integrationError: IntegrationError = {
      id: this.generateErrorId(),
      integrationId,
      tenantId,
      provider,
      operation,
      errorType,
      errorMessage: error.message,
      errorCode: this.extractErrorCode(error),
      httpStatus: this.extractHttpStatus(error),
      retryCount: 0,
      maxRetries: policy.maxRetries,
      resolved: false,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.errors.set(integrationError.id, integrationError);

    // Schedule retry if applicable
    if (this.shouldRetry(integrationError)) {
      await this.scheduleRetry(integrationError);
    } else {
      // Mark integration as unhealthy if no more retries
      await this.updateIntegrationStatus(integrationId, 'error');
    }

    // Log error for monitoring
    console.error(`Integration error recorded:`, {
      id: integrationError.id,
      provider,
      operation,
      errorType,
      message: error.message,
      retryCount: integrationError.retryCount,
      maxRetries: integrationError.maxRetries
    });

    return integrationError.id;
  }

  /**
   * Classify error type based on error properties
   */
  private static classifyError(error: Error): IntegrationError['errorType'] {
    const message = error.message.toLowerCase();
    const httpStatus = this.extractHttpStatus(error);

    // Authentication errors
    if (httpStatus === 401 || message.includes('unauthorized') || message.includes('invalid token')) {
      return 'auth';
    }

    // Rate limiting
    if (httpStatus === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }

    // Timeout errors
    if (httpStatus === 408 || message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') || message.includes('dns')) {
      return 'network';
    }

    // Validation errors
    if (httpStatus === 400 || message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }

    // API errors
    if (httpStatus && httpStatus >= 500) {
      return 'api_error';
    }

    return 'unknown';
  }

  /**
   * Extract HTTP status code from error
   */
  private static extractHttpStatus(error: any): number | undefined {
    return error.status || error.statusCode || error.response?.status;
  }

  /**
   * Extract error code from error
   */
  private static extractErrorCode(error: any): string | undefined {
    return error.code || error.response?.data?.error?.code;
  }

  /**
   * Check if error should be retried
   */
  private static shouldRetry(error: IntegrationError): boolean {
    return error.retryCount < error.maxRetries && 
           error.errorType !== 'validation' && 
           !error.resolved;
  }

  /**
   * Schedule retry with exponential backoff
   */
  private static async scheduleRetry(error: IntegrationError): Promise<void> {
    const policy = this.retryPolicies[error.errorType];
    
    // Calculate delay with exponential backoff and jitter
    const exponentialDelay = policy.baseDelayMs * Math.pow(policy.exponentialFactor, error.retryCount);
    const jitter = Math.random() * policy.jitterMs;
    const delay = Math.min(exponentialDelay + jitter, policy.maxDelayMs);
    
    error.nextRetryAt = new Date(Date.now() + delay);
    error.updatedAt = new Date();
    
    console.log(`Scheduling retry for error ${error.id} in ${delay}ms (attempt ${error.retryCount + 1}/${error.maxRetries})`);

    // Clear existing timeout if any
    const existingTimeout = this.retryQueue.get(error.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new retry
    const timeout = setTimeout(async () => {
      await this.executeRetry(error.id);
    }, delay);

    this.retryQueue.set(error.id, timeout);
  }

  /**
   * Execute retry attempt
   */
  private static async executeRetry(errorId: string): Promise<void> {
    const error = this.errors.get(errorId);
    if (!error || error.resolved) {
      return;
    }

    error.retryCount++;
    error.updatedAt = new Date();
    error.nextRetryAt = undefined;

    console.log(`Executing retry for error ${errorId} (attempt ${error.retryCount}/${error.maxRetries})`);

    try {
      // Execute the retry based on operation type
      const success = await this.retryOperation(error);
      
      if (success) {
        error.resolved = true;
        console.log(`Retry successful for error ${errorId}`);
        
        // Update integration status to connected
        await this.updateIntegrationStatus(error.integrationId, 'connected');
      } else {
        // Schedule next retry if attempts remain
        if (this.shouldRetry(error)) {
          await this.scheduleRetry(error);
        } else {
          console.log(`Max retries reached for error ${errorId}`);
          await this.updateIntegrationStatus(error.integrationId, 'error');
        }
      }
    } catch (retryError) {
      console.error(`Retry failed for error ${errorId}:`, retryError);
      
      // Schedule next retry if attempts remain
      if (this.shouldRetry(error)) {
        await this.scheduleRetry(error);
      } else {
        await this.updateIntegrationStatus(error.integrationId, 'error');
      }
    }

    // Clean up completed retry from queue
    this.retryQueue.delete(errorId);
  }

  /**
   * Retry the failed operation
   */
  private static async retryOperation(error: IntegrationError): Promise<boolean> {
    // This would call the appropriate service method based on the operation
    // For now, we'll implement a basic test connection
    switch (error.operation) {
      case 'oauth_refresh':
        return await this.retryTokenRefresh(error);
      case 'data_sync':
        return await this.retryDataSync(error);
      case 'webhook_delivery':
        return await this.retryWebhookDelivery(error);
      default:
        return await this.testConnection(error);
    }
  }

  /**
   * Retry token refresh
   */
  private static async retryTokenRefresh(error: IntegrationError): Promise<boolean> {
    // Implementation would depend on the specific provider
    // This is a placeholder that simulates token refresh
    try {
      // Add actual token refresh logic here
      console.log(`Attempting token refresh for integration ${error.integrationId}`);
      return Math.random() > 0.3; // Simulate 70% success rate
    } catch (err) {
      return false;
    }
  }

  /**
   * Retry data synchronization
   */
  private static async retryDataSync(error: IntegrationError): Promise<boolean> {
    try {
      // Add actual data sync retry logic here
      console.log(`Attempting data sync retry for integration ${error.integrationId}`);
      return Math.random() > 0.2; // Simulate 80% success rate
    } catch (err) {
      return false;
    }
  }

  /**
   * Retry webhook delivery
   */
  private static async retryWebhookDelivery(error: IntegrationError): Promise<boolean> {
    try {
      // Add actual webhook retry logic here
      console.log(`Attempting webhook delivery retry for integration ${error.integrationId}`);
      return Math.random() > 0.1; // Simulate 90% success rate
    } catch (err) {
      return false;
    }
  }

  /**
   * Test connection to integration
   */
  private static async testConnection(error: IntegrationError): Promise<boolean> {
    try {
      // Add actual connection test logic here
      console.log(`Testing connection for integration ${error.integrationId}`);
      return Math.random() > 0.2; // Simulate 80% success rate
    } catch (err) {
      return false;
    }
  }

  /**
   * Update integration status in database
   */
  private static async updateIntegrationStatus(integrationId: string, status: string): Promise<void> {
    try {
      await db.update(systemIntegrations)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(systemIntegrations.id, integrationId));
    } catch (error) {
      console.error(`Failed to update integration status:`, error);
    }
  }

  /**
   * Get integration health metrics
   */
  static async getIntegrationHealth(integrationId: string): Promise<IntegrationHealth | null> {
    try {
      const integration = await db.select()
        .from(systemIntegrations)
        .where(eq(systemIntegrations.id, integrationId))
        .limit(1);

      if (integration.length === 0) {
        return null;
      }

      const errors = Array.from(this.errors.values())
        .filter(error => error.integrationId === integrationId);

      const recentErrors = errors.filter(error => 
        error.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

      const totalAttempts = recentErrors.length;
      const successCount = recentErrors.filter(error => error.resolved).length;
      const errorCount = totalAttempts - successCount;
      const errorRate = totalAttempts > 0 ? (errorCount / totalAttempts) * 100 : 0;

      let status: IntegrationHealth['status'] = 'healthy';
      if (integration[0].status === 'error' || errorRate > 50) {
        status = 'unhealthy';
      } else if (errorRate > 20) {
        status = 'degraded';
      } else if (integration[0].status === 'disconnected') {
        status = 'disconnected';
      }

      return {
        integrationId,
        provider: integration[0].provider,
        status,
        uptime: this.calculateUptime(errors),
        errorRate,
        lastError: errors.length > 0 ? errors[errors.length - 1].createdAt : undefined,
        lastSuccess: integration[0].lastSync || undefined,
        responseTime: this.calculateAverageResponseTime(integrationId),
        errorCount,
        successCount
      };
    } catch (error) {
      console.error(`Failed to get integration health:`, error);
      return null;
    }
  }

  /**
   * Calculate uptime percentage
   */
  private static calculateUptime(errors: IntegrationError[]): number {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = errors.filter(error => error.createdAt > last24Hours);
    
    // Simple uptime calculation: assume 5 minutes downtime per unresolved error
    const downtime = recentErrors.filter(error => !error.resolved).length * 5;
    const uptime = Math.max(0, (24 * 60 - downtime) / (24 * 60)) * 100;
    
    return Math.round(uptime * 100) / 100;
  }

  /**
   * Calculate average response time (mock implementation)
   */
  private static calculateAverageResponseTime(integrationId: string): number {
    // This would typically be measured during actual API calls
    return 150 + Math.random() * 200; // Mock response time between 150-350ms
  }

  /**
   * Get all errors for an integration
   */
  static getErrorsForIntegration(integrationId: string): IntegrationError[] {
    return Array.from(this.errors.values())
      .filter(error => error.integrationId === integrationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all unresolved errors
   */
  static getUnresolvedErrors(): IntegrationError[] {
    return Array.from(this.errors.values())
      .filter(error => !error.resolved)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark error as resolved
   */
  static resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      error.updatedAt = new Date();
      
      // Cancel any pending retries
      const timeout = this.retryQueue.get(errorId);
      if (timeout) {
        clearTimeout(timeout);
        this.retryQueue.delete(errorId);
      }
      
      return true;
    }
    return false;
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old errors (cleanup)
   */
  static cleanupOldErrors(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, error] of this.errors.entries()) {
      if (error.createdAt < cutoffDate && error.resolved) {
        this.errors.delete(id);
        deletedCount++;
      }
    }

    console.log(`Cleaned up ${deletedCount} old errors`);
    return deletedCount;
  }
}