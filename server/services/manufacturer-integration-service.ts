import { eq, and, desc, gte, lte, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import {
  manufacturerIntegrations,
  deviceRegistrations,
  deviceMetrics,
  integrationAuditLogs,
  thirdPartyIntegrations,
  type ManufacturerIntegration,
  type DeviceRegistration,
  type DeviceMetric,
  type InsertManufacturerIntegration,
  type InsertDeviceRegistration,
  type InsertDeviceMetric,
  type InsertIntegrationAuditLog,
} from '../../shared/manufacturer-integration-schema';

/**
 * Unified Manufacturer Integration Service
 * Handles all manufacturer API integrations for meter reading and device management
 */
export class ManufacturerIntegrationService {
  
  /**
   * Create a new manufacturer integration
   */
  async createIntegration(tenantId: string, integration: Omit<InsertManufacturerIntegration, 'tenantId'>): Promise<ManufacturerIntegration> {
    const [result] = await db.insert(manufacturerIntegrations)
      .values({ ...integration, tenantId })
      .returning();
    
    await this.logAuditEvent(tenantId, result.id, 'integration_created', 'info', 'Integration created successfully');
    
    return result;
  }

  /**
   * Get all integrations for a tenant
   */
  async getIntegrations(tenantId: string): Promise<ManufacturerIntegration[]> {
    return await db.select()
      .from(manufacturerIntegrations)
      .where(and(
        eq(manufacturerIntegrations.tenantId, tenantId),
        eq(manufacturerIntegrations.isActive, true)
      ))
      .orderBy(desc(manufacturerIntegrations.createdAt));
  }

  /**
   * Get integration by ID
   */
  async getIntegrationById(tenantId: string, integrationId: string): Promise<ManufacturerIntegration | null> {
    const [result] = await db.select()
      .from(manufacturerIntegrations)
      .where(and(
        eq(manufacturerIntegrations.id, integrationId),
        eq(manufacturerIntegrations.tenantId, tenantId)
      ));
    
    return result || null;
  }

  /**
   * Update integration status
   */
  async updateIntegrationStatus(
    tenantId: string, 
    integrationId: string, 
    status: 'active' | 'inactive' | 'error' | 'pending_auth' | 'rate_limited' | 'maintenance',
    error?: string
  ): Promise<void> {
    await db.update(manufacturerIntegrations)
      .set({ 
        status, 
        lastError: error || null,
        errorCount: error ? db.select().from(manufacturerIntegrations).where(eq(manufacturerIntegrations.id, integrationId)) : 0,
        updatedAt: new Date()
      })
      .where(and(
        eq(manufacturerIntegrations.id, integrationId),
        eq(manufacturerIntegrations.tenantId, tenantId)
      ));

    await this.logAuditEvent(tenantId, integrationId, 'status_changed', error ? 'error' : 'info', 
      `Integration status changed to ${status}${error ? ': ' + error : ''}`);
  }

  /**
   * Register a device for data collection
   */
  async registerDevice(tenantId: string, device: Omit<InsertDeviceRegistration, 'tenantId'>): Promise<DeviceRegistration> {
    const [result] = await db.insert(deviceRegistrations)
      .values({ ...device, tenantId })
      .returning();
    
    await this.logAuditEvent(tenantId, device.integrationId, 'device_registered', 'info', 
      `Device registered: ${device.serialNumber || device.deviceId}`);
    
    return result;
  }

  /**
   * Get all registered devices for a tenant
   */
  async getDevices(tenantId: string, integrationId?: string): Promise<DeviceRegistration[]> {
    const conditions = [
      eq(deviceRegistrations.tenantId, tenantId),
      eq(deviceRegistrations.isActive, true)
    ];
    
    if (integrationId) {
      conditions.push(eq(deviceRegistrations.integrationId, integrationId));
    }
    
    return await db.select()
      .from(deviceRegistrations)
      .where(and(...conditions))
      .orderBy(desc(deviceRegistrations.registeredAt));
  }

  /**
   * Collect meter data from a device
   */
  async collectDeviceMetrics(
    tenantId: string, 
    deviceRegistrationId: string, 
    metrics: Omit<InsertDeviceMetric, 'tenantId' | 'deviceRegistrationId'>[]
  ): Promise<DeviceMetric[]> {
    const device = await this.getDeviceById(tenantId, deviceRegistrationId);
    if (!device) {
      throw new Error('Device not found');
    }

    const metricsWithTenantAndDevice = metrics.map(metric => ({
      ...metric,
      tenantId,
      deviceRegistrationId,
      integrationId: device.integrationId
    }));

    const results = await db.insert(deviceMetrics)
      .values(metricsWithTenantAndDevice)
      .returning();

    // Update device last collection time
    await db.update(deviceRegistrations)
      .set({ 
        lastDataCollectedAt: new Date(),
        lastUpdatedAt: new Date()
      })
      .where(and(
        eq(deviceRegistrations.id, deviceRegistrationId),
        eq(deviceRegistrations.tenantId, tenantId)
      ));

    await this.logAuditEvent(tenantId, device.integrationId, 'data_collection', 'success', 
      `Collected ${results.length} metrics from device ${device.serialNumber || device.deviceId}`, 
      deviceRegistrationId);

    return results;
  }

  /**
   * Get device by ID
   */
  async getDeviceById(tenantId: string, deviceId: string): Promise<DeviceRegistration | null> {
    const [result] = await db.select()
      .from(deviceRegistrations)
      .where(and(
        eq(deviceRegistrations.id, deviceId),
        eq(deviceRegistrations.tenantId, tenantId)
      ));
    
    return result || null;
  }

  /**
   * Get latest metrics for a device
   */
  async getDeviceMetrics(
    tenantId: string, 
    deviceRegistrationId: string, 
    metricTypes?: string[],
    fromDate?: Date,
    toDate?: Date
  ): Promise<DeviceMetric[]> {
    const conditions = [
      eq(deviceMetrics.tenantId, tenantId),
      eq(deviceMetrics.deviceRegistrationId, deviceRegistrationId)
    ];

    if (metricTypes && metricTypes.length > 0) {
      conditions.push(or(...metricTypes.map(type => eq(deviceMetrics.metricType, type))));
    }

    if (fromDate) {
      conditions.push(gte(deviceMetrics.measurementTimestamp, fromDate));
    }

    if (toDate) {
      conditions.push(lte(deviceMetrics.measurementTimestamp, toDate));
    }

    return await db.select()
      .from(deviceMetrics)
      .where(and(...conditions))
      .orderBy(desc(deviceMetrics.measurementTimestamp));
  }

  /**
   * Get integrations due for data collection
   */
  async getIntegrationsDueForCollection(): Promise<ManufacturerIntegration[]> {
    const now = new Date();
    
    return await db.select()
      .from(manufacturerIntegrations)
      .where(and(
        eq(manufacturerIntegrations.isActive, true),
        eq(manufacturerIntegrations.status, 'active'),
        or(
          isNull(manufacturerIntegrations.nextCollectionAt),
          lte(manufacturerIntegrations.nextCollectionAt, now)
        )
      ));
  }

  /**
   * Update next collection time for an integration
   */
  async updateNextCollectionTime(integrationId: string, nextCollectionAt: Date): Promise<void> {
    await db.update(manufacturerIntegrations)
      .set({ 
        lastCollectionAt: new Date(),
        nextCollectionAt,
        updatedAt: new Date()
      })
      .where(eq(manufacturerIntegrations.id, integrationId));
  }

  /**
   * Log audit event
   */
  async logAuditEvent(
    tenantId: string,
    integrationId: string,
    eventType: string,
    eventCategory: 'success' | 'error' | 'warning' | 'info',
    message: string,
    deviceRegistrationId?: string,
    requestData?: any,
    responseData?: any,
    httpStatusCode?: number,
    responseTimeMs?: number
  ): Promise<void> {
    const auditLog: InsertIntegrationAuditLog = {
      tenantId,
      integrationId,
      deviceRegistrationId,
      eventType,
      eventCategory,
      message,
      requestData: requestData || {},
      responseData: responseData || {},
      httpStatusCode,
      responseTimeMs,
      dataPointsCollected: responseData?.dataPoints?.length || 0
    };

    await db.insert(integrationAuditLogs).values(auditLog);
  }

  /**
   * Get audit logs for troubleshooting
   */
  async getAuditLogs(
    tenantId: string,
    integrationId?: string,
    eventCategory?: string,
    fromDate?: Date,
    limit: number = 100
  ): Promise<any[]> {
    const conditions = [eq(integrationAuditLogs.tenantId, tenantId)];
    
    if (integrationId) {
      conditions.push(eq(integrationAuditLogs.integrationId, integrationId));
    }
    
    if (eventCategory) {
      conditions.push(eq(integrationAuditLogs.eventCategory, eventCategory));
    }
    
    if (fromDate) {
      conditions.push(gte(integrationAuditLogs.timestamp, fromDate));
    }

    return await db.select()
      .from(integrationAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(integrationAuditLogs.timestamp))
      .limit(limit);
  }

  /**
   * Calculate next collection time based on frequency
   */
  calculateNextCollectionTime(frequency: string, lastCollection?: Date): Date {
    const now = lastCollection || new Date();
    
    switch (frequency) {
      case 'real_time':
        return new Date(now.getTime() + 60 * 1000); // 1 minute
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to daily
    }
  }

  /**
   * Check if integration is rate limited
   */
  async checkRateLimit(integrationId: string): Promise<boolean> {
    const [integration] = await db.select()
      .from(manufacturerIntegrations)
      .where(eq(manufacturerIntegrations.id, integrationId));
    
    if (!integration) return false;
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - (integration.rateLimitWindow * 1000));
    
    // Reset rate limit if window has passed
    if (!integration.rateLimitResetAt || integration.rateLimitResetAt < windowStart) {
      await db.update(manufacturerIntegrations)
        .set({
          currentRequests: 0,
          rateLimitResetAt: new Date(now.getTime() + (integration.rateLimitWindow * 1000))
        })
        .where(eq(manufacturerIntegrations.id, integrationId));
      return false;
    }
    
    return integration.currentRequests >= integration.rateLimitRequests;
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(integrationId: string): Promise<void> {
    await db.update(manufacturerIntegrations)
      .set({
        currentRequests: db.select().from(manufacturerIntegrations).where(eq(manufacturerIntegrations.id, integrationId))
      })
      .where(eq(manufacturerIntegrations.id, integrationId));
  }
}