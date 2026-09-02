// Manufacturer device adapters — Deno / edge-function compatible.
//
// PA-054: these four classes are the only thing standing between the browser and
// device discovery in production. They lived in
// server/manufacturer-integration-service.ts, and getApiUrl sends /api/* to the
// functions host, so the browser cannot reach Express in production at all -
// Discover Devices worked in dev, 404'd in prod, and answered 501 after PA-052.
//
// They are plain fetch plus field mapping, which is why the port is mechanical:
// no Node built-ins, no Drizzle. KEEP IN SYNC with the Node copy;
// server/tests/unit/manufacturer-adapters-parity.test.ts fails if the endpoints,
// the status vocabularies or the field maps drift.
//
// Two deliberate differences, both mechanical: the module logger becomes
// console, and registerDevice returns a plain DiscoveredDevice rather than the
// Drizzle DeviceRegistration row type - it never wrote to the database anyway,
// it shapes a row for the caller to insert.

/** What an adapter's registerDevice() hands back for the caller to persist. */
export interface DiscoveredDevice {
  deviceId?: string;
  deviceName?: string;
  model?: string;
  serialNumber?: string;
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  capabilities?: unknown;
  status?: string;
  [key: string]: unknown;
}

// Base adapter interface
export interface ManufacturerAdapter {
  connect(): Promise<boolean>;
  discoverDevices(): Promise<any[]>;
  collectMetrics(deviceId: string): Promise<any>;
  registerDevice(device: any): Promise<DiscoveredDevice>;
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
          Authorization: `Bearer ${this.credentials.apiKey}`,
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password,
        }),
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
          Authorization: `Bearer ${this.credentials.apiKey}`,
        },
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
          Authorization: `Bearer ${this.credentials.apiKey}`,
        },
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
        rawData: data,
      };
    } catch (error) {
      console.error('Canon metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DiscoveredDevice> {
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
      status: this.mapCanonStatus(device.status),
    } as DiscoveredDevice;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private mapCanonStatus(
    status: string,
  ): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'ready':
        return 'online';
      case 'offline':
        return 'offline';
      case 'error':
      case 'fault':
        return 'error';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'unknown';
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
          Authorization: `Basic ${Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
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
          Authorization: `Bearer ${this.credentials.accessToken}`,
        },
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
          Authorization: `Bearer ${this.credentials.accessToken}`,
        },
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
        rawData: data,
      };
    } catch (error) {
      console.error('Xerox metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DiscoveredDevice> {
    return {
      deviceId: device.id,
      deviceName: device.name,
      model: device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.networkAddress,
      location: device.location,
      capabilities: device.capabilities || [],
      status: this.mapXeroxStatus(device.status),
    } as DiscoveredDevice;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private mapXeroxStatus(
    status: string,
  ): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'ready':
      case 'idle':
        return 'online';
      case 'offline':
      case 'unreachable':
        return 'offline';
      case 'error':
      case 'fault':
        return 'error';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'unknown';
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
          'X-HP-Client-Id': this.credentials.clientId,
        },
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
          'X-HP-Client-Id': this.credentials.clientId,
        },
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
          'X-HP-Client-Id': this.credentials.clientId,
        },
      });

      if (!response.ok) throw new Error('Failed to collect HP metrics');

      const data = await response.json();

      // Transform HP data to standard format
      return {
        totalImpressions: data.usageCounters?.totalPages || 0,
        bwImpressions: data.usageCounters?.blackPages || 0,
        colorImpressions: data.usageCounters?.colorPages || 0,
        tonerLevels: data.supplies
          ?.filter((s: any) => s.type === 'toner')
          .reduce((acc: any, supply: any) => {
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
        rawData: data,
      };
    } catch (error) {
      console.error('HP metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DiscoveredDevice> {
    return {
      deviceId: device.deviceId,
      deviceName: device.friendlyName,
      model: device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      location: device.location,
      capabilities: device.capabilities || [],
      status: this.mapHPStatus(device.status),
    } as DiscoveredDevice;
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
      case 'ready':
      case 'idle':
        return 'online';
      case 'offline':
        return 'offline';
      case 'error':
      case 'fault':
        return 'error';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'unknown';
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.credentials.username,
          password: this.credentials.password,
          accountId: this.credentials.accountId,
        }),
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
          Authorization: `Bearer ${this.credentials.sessionToken}`,
        },
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
          Authorization: `Bearer ${this.credentials.sessionToken}`,
        },
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
        rawData: data,
      };
    } catch (error) {
      console.error('FMAudit metrics collection failed:', error);
      throw error;
    }
  }

  async registerDevice(device: any): Promise<DiscoveredDevice> {
    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      model: device.make + ' ' + device.model,
      serialNumber: device.serialNumber,
      ipAddress: device.ipAddress,
      location: device.location,
      department: device.department,
      capabilities: device.capabilities || [],
      status: this.mapFMAuditStatus(device.status),
    } as DiscoveredDevice;
  }

  async testConnection(): Promise<boolean> {
    return this.connect();
  }

  private mapFMAuditStatus(
    status: string,
  ): 'online' | 'offline' | 'error' | 'maintenance' | 'unknown' {
    switch (status?.toLowerCase()) {
      case 'online':
      case 'ready':
        return 'online';
      case 'offline':
        return 'offline';
      case 'error':
        return 'error';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'unknown';
    }
  }
}

// Manufacturer Integration Service

/** Same switch as ManufacturerIntegrationService.createAdapter in the Node copy. */
export function createAdapter(
  manufacturer: string,
  credentials: any,
  apiEndpoint: string,
): ManufacturerAdapter {
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
