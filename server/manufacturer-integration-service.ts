import { db } from "./db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
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
} from "@shared/manufacturer-integration-schema";

// Base adapter interface
export interface ManufacturerAdapter {
  connect(): Promise<boolean>;
  discoverDevices(): Promise<any[]>;
  collectMetrics(deviceId: string): Promise<any>;
  registerDevice(device: any): Promise<DeviceRegistration>;
  testConnection(): Promise<boolean>;
}

// Canon DCA + eMaintenance Adapter
export class CanonAdapter implements ManufacturerAdapter {
  private credentials: any;
  private apiEndpoint: string;

  constructor(credentials: any, apiEndpoint: string) {
    this.credentials = credentials;
    this.apiEndpoint = apiEndpoint;
  }

  async connect(): Promise<boolean> {
    try {
      // Canon DCA authentication
      const response = await fetch(`${this.apiEndpoint}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.apiKey}`
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password
        })
      });
      return response.ok;
    } catch (error) {
      console.error('Canon connection failed:', error);
      return false;
    }
  }

  async discoverDevices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/devices`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to discover Canon devices');
      
      const data = await response.json();
      return data.devices || [];
    } catch (error) {
      console.error('Canon device discovery failed:', error);
      return [];
    }
  }

  async collectMetrics(deviceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiEndpoint}/devices/${deviceId}/metrics`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiKey}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to collect Canon metrics');
      
      const data = await response.json();
      
      // Transform Canon data to standard format
      return {
        totalImpressions: data.counters?.total || 0,
        bwImpressions: data.counters?.blackAndWhite || 0,
        colorImpressions: data.counters?.color || 0,
        tonerLevels: data.supplies?.toner || {},
        paperLevels: data.supplies?.paper || {},
        deviceStatus: this.mapCanonStatus(data.status),
        errorCodes: data.errors || [],
        uptime: data.uptime || 0,
        rawData: data
      };
    } catch (error) {
      console.error('Canon metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DeviceRegistration> {
    // Transform Canon device data to standard format
    return {
      deviceId: device.id,
      deviceName: device.name,
      model: device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.networkInfo?.ipAddress,
      macAddress: device.networkInfo?.macAddress,
      location: device.location,
      capabilities: device.capabilities || [],
      status: this.mapCanonStatus(device.status)
    } as DeviceRegistration;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private mapCanonStatus(status: string): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'ready': return 'online';
      case 'offline': return 'offline';
      case 'error': case 'fault': return 'error';
      case 'maintenance': return 'maintenance';
      default: return 'unknown';
    }
  }
}

// Xerox ConnectKey + MPS Adapter
export class XeroxAdapter implements ManufacturerAdapter {
  private credentials: any;
  private apiEndpoint: string;

  constructor(credentials: any, apiEndpoint: string) {
    this.credentials = credentials;
    this.apiEndpoint = apiEndpoint;
  }

  async connect(): Promise<boolean> {
    try {
      // Xerox OAuth2 authentication
      const response = await fetch(`${this.apiEndpoint}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.credentials.accessToken = data.access_token;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Xerox connection failed:', error);
      return false;
    }
  }

  async discoverDevices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/devices`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to discover Xerox devices');
      
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Xerox device discovery failed:', error);
      return [];
    }
  }

  async collectMetrics(deviceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiEndpoint}/devices/${deviceId}/usage`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to collect Xerox metrics');
      
      const data = await response.json();
      
      // Transform Xerox data to standard format
      return {
        totalImpressions: data.usage?.totalImpressions || 0,
        bwImpressions: data.usage?.monoImpressions || 0,
        colorImpressions: data.usage?.colorImpressions || 0,
        tonerLevels: data.supplies?.reduce((acc: any, supply: any) => {
          if (supply.type === 'toner') {
            acc[supply.color] = supply.level;
          }
          return acc;
        }, {}),
        paperLevels: data.paperTrays?.reduce((acc: any, tray: any) => {
          acc[`tray${tray.number}`] = tray.level;
          return acc;
        }, {}),
        deviceStatus: this.mapXeroxStatus(data.status),
        errorCodes: data.alerts?.map((alert: any) => alert.code) || [],
        uptime: data.uptime || 0,
        rawData: data
      };
    } catch (error) {
      console.error('Xerox metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DeviceRegistration> {
    return {
      deviceId: device.id,
      deviceName: device.name,
      model: device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.networkAddress,
      location: device.location,
      capabilities: device.capabilities || [],
      status: this.mapXeroxStatus(device.status)
    } as DeviceRegistration;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private mapXeroxStatus(status: string): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'ready': case 'idle': return 'online';
      case 'offline': case 'unreachable': return 'offline';
      case 'error': case 'fault': return 'error';
      case 'maintenance': return 'maintenance';
      default: return 'unknown';
    }
  }
}

// HP PrintOS + SDS Adapter
export class HPAdapter implements ManufacturerAdapter {
  private credentials: any;
  private apiEndpoint: string;

  constructor(credentials: any, apiEndpoint: string) {
    this.credentials = credentials;
    this.apiEndpoint = apiEndpoint;
  }

  async connect(): Promise<boolean> {
    try {
      // HP HMAC authentication
      const timestamp = Date.now().toString();
      const signature = this.generateHMACSignature(timestamp);
      
      const response = await fetch(`${this.apiEndpoint}/auth/validate`, {
        method: 'POST',
        headers: {
          'X-HP-HMAC-Algorithm': 'SHA256',
          'X-HP-HMAC-Timestamp': timestamp,
          'X-HP-HMAC-Signature': signature,
          'X-HP-Client-Id': this.credentials.clientId
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('HP connection failed:', error);
      return false;
    }
  }

  async discoverDevices(): Promise<any[]> {
    try {
      const timestamp = Date.now().toString();
      const signature = this.generateHMACSignature(timestamp);
      
      const response = await fetch(`${this.apiEndpoint}/devices`, {
        headers: {
          'X-HP-HMAC-Algorithm': 'SHA256',
          'X-HP-HMAC-Timestamp': timestamp,
          'X-HP-HMAC-Signature': signature,
          'X-HP-Client-Id': this.credentials.clientId
        }
      });
      
      if (!response.ok) throw new Error('Failed to discover HP devices');
      
      const data = await response.json();
      return data.devices || [];
    } catch (error) {
      console.error('HP device discovery failed:', error);
      return [];
    }
  }

  async collectMetrics(deviceId: string): Promise<any> {
    try {
      const timestamp = Date.now().toString();
      const signature = this.generateHMACSignature(timestamp);
      
      const response = await fetch(`${this.apiEndpoint}/devices/${deviceId}/usage`, {
        headers: {
          'X-HP-HMAC-Algorithm': 'SHA256',
          'X-HP-HMAC-Timestamp': timestamp,
          'X-HP-HMAC-Signature': signature,
          'X-HP-Client-Id': this.credentials.clientId
        }
      });
      
      if (!response.ok) throw new Error('Failed to collect HP metrics');
      
      const data = await response.json();
      
      // Transform HP data to standard format
      return {
        totalImpressions: data.usageCounters?.totalPages || 0,
        bwImpressions: data.usageCounters?.blackPages || 0,
        colorImpressions: data.usageCounters?.colorPages || 0,
        tonerLevels: data.supplies?.filter((s: any) => s.type === 'toner').reduce((acc: any, supply: any) => {
          acc[supply.colorant] = supply.level;
          return acc;
        }, {}),
        paperLevels: data.inputTrays?.reduce((acc: any, tray: any) => {
          acc[`tray${tray.trayId}`] = tray.level;
          return acc;
        }, {}),
        deviceStatus: this.mapHPStatus(data.status),
        errorCodes: data.consumableAlerts?.map((alert: any) => alert.alertCode) || [],
        uptime: data.uptime || 0,
        rawData: data
      };
    } catch (error) {
      console.error('HP metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DeviceRegistration> {
    return {
      deviceId: device.deviceId,
      deviceName: device.friendlyName,
      model: device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      location: device.location,
      capabilities: device.capabilities || [],
      status: this.mapHPStatus(device.status)
    } as DeviceRegistration;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private generateHMACSignature(timestamp: string): string {
    // Simplified HMAC generation - in production, use proper crypto
    const crypto = require('crypto');
    const message = `${this.credentials.clientId}${timestamp}`;
    return crypto.createHmac('sha256', this.credentials.clientSecret).update(message).digest('hex');
  }

  private mapHPStatus(status: string): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'ready': case 'idle': return 'online';
      case 'offline': return 'offline';
      case 'error': case 'fault': return 'error';
      case 'maintenance': return 'maintenance';
      default: return 'unknown';
    }
  }
}

// FMAudit Third-Party Adapter
export class FMAuditAdapter implements ManufacturerAdapter {
  private credentials: any;
  private apiEndpoint: string;

  constructor(credentials: any, apiEndpoint: string) {
    this.credentials = credentials;
    this.apiEndpoint = apiEndpoint;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password,
          accountId: this.credentials.accountId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.credentials.sessionToken = data.sessionToken;
        return true;
      }
      return false;
    } catch (error) {
      console.error('FMAudit connection failed:', error);
      return false;
    }
  }

  async discoverDevices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.sessionToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to discover FMAudit devices');
      
      const data = await response.json();
      return data.devices || [];
    } catch (error) {
      console.error('FMAudit device discovery failed:', error);
      return [];
    }
  }

  async collectMetrics(deviceId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/devices/${deviceId}/meters`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.sessionToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to collect FMAudit metrics');
      
      const data = await response.json();
      
      // Transform FMAudit data to standard format
      return {
        totalImpressions: data.totalCount || 0,
        bwImpressions: data.blackCount || 0,
        colorImpressions: data.colorCount || 0,
        largeImpressions: data.largeFormatCount || 0,
        tonerLevels: data.tonerLevels || {},
        deviceStatus: this.mapFMAuditStatus(data.deviceStatus),
        errorCodes: data.errorCodes || [],
        uptime: data.uptime || 0,
        rawData: data
      };
    } catch (error) {
      console.error('FMAudit metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DeviceRegistration> {
    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      model: device.make + ' ' + device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.ipAddress,
      location: device.location,
      department: device.department,
      capabilities: device.capabilities || [],
      status: this.mapFMAuditStatus(device.status)
    } as DeviceRegistration;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private mapFMAuditStatus(status: string): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'online': case 'ready': return 'online';
      case 'offline': return 'offline';
      case 'error': return 'error';
      case 'maintenance': return 'maintenance';
      default: return 'unknown';
    }
  }
}

// Manufacturer Integration Service
export class ManufacturerIntegrationService {
  private adapters: Map<string, ManufacturerAdapter> = new Map();

  constructor() {}

  private createAdapter(manufacturer: string, credentials: any, apiEndpoint: string): ManufacturerAdapter {
    switch (manufacturer) {
      case 'canon':
        return new CanonAdapter(credentials, apiEndpoint);
      case 'xerox':
        return new XeroxAdapter(credentials, apiEndpoint);
      case 'hp':
        return new HPAdapter(credentials, apiEndpoint);
      case 'fmaudit':
        return new FMAuditAdapter(credentials, apiEndpoint);
      default:
        throw new Error(`Unsupported manufacturer: ${manufacturer}`);
    }
  }

  async createIntegration(tenantId: string, integration: InsertManufacturerIntegration): Promise<ManufacturerIntegration> {
    try {
      // Create adapter and test connection
      const adapter = this.createAdapter(
        integration.manufacturer,
        integration.credentials,
        integration.apiEndpoint || ''
      );

      const connected = await adapter.testConnection();
      
      const [newIntegration] = await db.insert(manufacturerIntegrations).values({
        ...integration,
        tenantId,
        status: connected ? 'active' : 'error'
      }).returning();

      // Log the integration creation
      await this.logAuditEvent(tenantId, newIntegration.id, null, 'integration_created', 
        connected ? 'success' : 'error', 
        connected ? 'Integration created successfully' : 'Failed to connect to manufacturer API'
      );

      return newIntegration;
    } catch (error) {
      console.error('Failed to create integration:', error);
      throw error;
    }
  }

  async discoverAndRegisterDevices(tenantId: string, integrationId: string): Promise<DeviceRegistration[]> {
    try {
      const integration = await db.select().from(manufacturerIntegrations)
        .where(and(
          eq(manufacturerIntegrations.tenantId, tenantId),
          eq(manufacturerIntegrations.id, integrationId)
        ))
        .limit(1);

      if (!integration[0]) {
        throw new Error('Integration not found');
      }

      const adapter = this.createAdapter(
        integration[0].manufacturer,
        integration[0].credentials,
        integration[0].apiEndpoint || ''
      );

      const devices = await adapter.discoverDevices();
      const registeredDevices: DeviceRegistration[] = [];

      for (const device of devices) {
        try {
          const deviceData = await adapter.registerDevice(device);
          
          const [registeredDevice] = await db.insert(deviceRegistrations).values({
            ...deviceData,
            tenantId,
            integrationId
          }).returning();

          registeredDevices.push(registeredDevice);

          await this.logAuditEvent(tenantId, integrationId, registeredDevice.id, 'device_registered', 
            'success', `Device ${deviceData.deviceName} registered successfully`
          );
        } catch (error) {
          console.error(`Failed to register device ${device.id}:`, error);
          await this.logAuditEvent(tenantId, integrationId, null, 'device_registration_failed', 
            'error', `Failed to register device ${device.id}: ${error}`
          );
        }
      }

      return registeredDevices;
    } catch (error) {
      console.error('Failed to discover devices:', error);
      throw error;
    }
  }

  async collectDeviceMetrics(tenantId: string, deviceId: string): Promise<DeviceMetric> {
    try {
      const device = await db.select()
        .from(deviceRegistrations)
        .innerJoin(manufacturerIntegrations, eq(deviceRegistrations.integrationId, manufacturerIntegrations.id))
        .where(and(
          eq(deviceRegistrations.tenantId, tenantId),
          eq(deviceRegistrations.id, deviceId)
        ))
        .limit(1);

      if (!device[0]) {
        throw new Error('Device not found');
      }

      const deviceReg = device[0].device_registrations;
      const integration = device[0].manufacturer_integrations;

      const adapter = this.createAdapter(
        integration.manufacturer,
        integration.credentials,
        integration.apiEndpoint || ''
      );

      const startTime = Date.now();
      const metrics = await adapter.collectMetrics(deviceReg.deviceId);
      const responseTime = Date.now() - startTime;

      const [deviceMetric] = await db.insert(deviceMetrics).values({
        tenantId,
        deviceId,
        integrationId: integration.id,
        collectionTimestamp: new Date(),
        responseTime,
        ...metrics
      }).returning();

      // Update device last seen
      await db.update(deviceRegistrations)
        .set({ lastSeen: new Date(), updatedAt: new Date() })
        .where(eq(deviceRegistrations.id, deviceId));

      await this.logAuditEvent(tenantId, integration.id, deviceId, 'metrics_collected', 
        'success', `Metrics collected successfully in ${responseTime}ms`, { responseTime }
      );

      return deviceMetric;
    } catch (error) {
      console.error('Failed to collect device metrics:', error);
      await this.logAuditEvent(tenantId, null, deviceId, 'metrics_collection_failed', 
        'error', `Failed to collect metrics: ${error}`
      );
      throw error;
    }
  }

  async scheduleMetricsCollection(tenantId: string, integrationId: string): Promise<void> {
    // This would integrate with a job scheduler like Bull/Redis
    // For now, we'll just update the next sync time
    await db.update(manufacturerIntegrations)
      .set({ 
        nextSync: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        updatedAt: new Date()
      })
      .where(and(
        eq(manufacturerIntegrations.tenantId, tenantId),
        eq(manufacturerIntegrations.id, integrationId)
      ));
  }

  private async logAuditEvent(
    tenantId: string,
    integrationId: string | null,
    deviceId: string | null,
    action: string,
    status: string,
    message: string,
    details: any = {}
  ): Promise<void> {
    try {
      await db.insert(integrationAuditLogs).values({
        tenantId,
        integrationId,
        deviceId,
        action,
        status,
        message,
        details,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const manufacturerIntegrationService = new ManufacturerIntegrationService();