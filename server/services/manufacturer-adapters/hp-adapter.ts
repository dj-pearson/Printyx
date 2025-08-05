import { BaseManufacturerAdapter, DeviceInfo, MeterReading, CollectionResult, IntegrationConfig } from './base-adapter';

/**
 * HP PrintOS and Smart Device Services Integration Adapter
 * Supports HP devices through PrintOS Device API and Smart Device Services
 */
export class HPAdapter extends BaseManufacturerAdapter {
  private accessToken?: string;
  private tokenExpiresAt?: Date;
  private sessionId?: string;

  constructor(config: IntegrationConfig) {
    super('hp', 'HP PrintOS', config);
  }

  async testConnection(): Promise<boolean> {
    try {
      this.validateConfig();
      
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/status`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('HP connection test failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      if (this.config.authType === 'api_key') {
        return await this.authenticateWithHMACKey();
      } else {
        throw new Error('Unsupported authentication type for HP integration');
      }
    } catch (error) {
      console.error('HP authentication failed:', error);
      return false;
    }
  }

  private async authenticateWithHMACKey(): Promise<boolean> {
    try {
      // HP PrintOS uses HMAC authentication
      const timestamp = new Date().toISOString();
      const signature = this.generateHMACSignature(timestamp);
      
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hp-hmac-authentication': `${this.config.authCredentials.apiKey}:${signature}`,
            'x-hp-hmac-date': timestamp
          },
          body: JSON.stringify({
            deviceType: this.config.authCredentials.deviceType || 'printer'
          })
        }
      );

      const data = await this.handleApiResponse(response);
      this.sessionId = data.sessionId;
      this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      return true;
    } catch (error) {
      console.error('HP HMAC authentication failed:', error);
      return false;
    }
  }

  private generateHMACSignature(timestamp: string): string {
    // Simplified HMAC generation - in production, use proper crypto library
    const crypto = require('crypto');
    const message = `POST\n/api/v1/auth/login\n${timestamp}`;
    return crypto.createHmac('sha256', this.config.authCredentials.apiSecret)
      .update(message)
      .digest('hex');
  }

  async discoverDevices(): Promise<DeviceInfo[]> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/devices`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const data = await this.handleApiResponse(response);
      return this.mapHPDevices(data.devices || data.printers || []);
    } catch (error) {
      console.error('HP device discovery failed:', error);
      return [];
    }
  }

  private mapHPDevices(devices: any[]): DeviceInfo[] {
    return devices.map(device => ({
      deviceId: device.deviceId || device.id,
      serialNumber: device.serialNumber,
      modelNumber: device.model || device.modelName,
      deviceName: device.name || device.hostname,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      capabilities: device.capabilities || ['meter_reading', 'status_monitoring', 'supply_monitoring'],
      supportedMetrics: [
        'total_pages_printed',
        'black_pages_printed',
        'color_pages_printed',
        'total_pages_copied',
        'total_pages_scanned',
        'total_pages_faxed',
        'black_cartridge_level',
        'cyan_cartridge_level',
        'magenta_cartridge_level',
        'yellow_cartridge_level',
        'photo_cartridge_level',
        'maintenance_kit_remaining',
        'paper_tray_levels'
      ]
    }));
  }

  async collectDeviceMetrics(deviceId: string): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      // HP requires device provisioning first, then statistics collection
      const statsResponse = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/devices/${deviceId}/statistics`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            statisticsType: 'usage_and_supplies'
          })
        }
      );

      const data = await this.handleApiResponse(statsResponse);
      const metrics = this.mapHPMetrics(data);
      
      return {
        success: true,
        deviceId,
        metrics,
        rawResponse: data,
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        deviceId,
        metrics: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs: Date.now() - startTime
      };
    }
  }

  private mapHPMetrics(data: any): MeterReading[] {
    const metrics: MeterReading[] = [];
    const timestamp = new Date();

    // Usage statistics
    if (data.usage) {
      // Total pages
      if (data.usage.totalPagesPrinted !== undefined) {
        metrics.push({
          metricType: 'total_pages_printed',
          metricName: 'Total Pages Printed',
          metricCategory: 'usage',
          numericValue: data.usage.totalPagesPrinted,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { totalPagesPrinted: data.usage.totalPagesPrinted }
        });
      }

      // Black pages
      if (data.usage.blackPagesPrinted !== undefined) {
        metrics.push({
          metricType: 'black_pages_printed',
          metricName: 'Black Pages Printed',
          metricCategory: 'usage',
          numericValue: data.usage.blackPagesPrinted,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { blackPagesPrinted: data.usage.blackPagesPrinted }
        });
      }

      // Color pages
      if (data.usage.colorPagesPrinted !== undefined) {
        metrics.push({
          metricType: 'color_pages_printed',
          metricName: 'Color Pages Printed',
          metricCategory: 'usage',
          numericValue: data.usage.colorPagesPrinted,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { colorPagesPrinted: data.usage.colorPagesPrinted }
        });
      }

      // Copy pages
      if (data.usage.totalPagesCopied !== undefined) {
        metrics.push({
          metricType: 'total_pages_copied',
          metricName: 'Total Pages Copied',
          metricCategory: 'usage',
          numericValue: data.usage.totalPagesCopied,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { totalPagesCopied: data.usage.totalPagesCopied }
        });
      }

      // Scan pages
      if (data.usage.totalPagesScanned !== undefined) {
        metrics.push({
          metricType: 'total_pages_scanned',
          metricName: 'Total Pages Scanned',
          metricCategory: 'usage',
          numericValue: data.usage.totalPagesScanned,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { totalPagesScanned: data.usage.totalPagesScanned }
        });
      }
    }

    // Supply levels
    if (data.supplies) {
      data.supplies.forEach((supply: any) => {
        if (supply.type && supply.level !== undefined) {
          const metricType = `${supply.color || supply.type}_level`.toLowerCase().replace(/\s+/g, '_');
          
          metrics.push({
            metricType,
            metricName: `${supply.name || supply.color || supply.type} Level`,
            metricCategory: 'supply',
            numericValue: supply.level,
            unit: supply.unit || 'percent',
            measurementTimestamp: timestamp,
            rawData: supply
          });
        }
      });
    }

    // Ink/Toner cartridges (alternative structure)
    if (data.cartridges) {
      Object.entries(data.cartridges).forEach(([color, info]: [string, any]) => {
        if (info.level !== undefined) {
          metrics.push({
            metricType: `${color}_cartridge_level`,
            metricName: `${color.charAt(0).toUpperCase() + color.slice(1)} Cartridge Level`,
            metricCategory: 'supply',
            numericValue: info.level,
            unit: info.unit || 'percent',
            measurementTimestamp: timestamp,
            rawData: { [color]: info }
          });
        }
      });
    }

    // Device status
    if (data.status) {
      metrics.push({
        metricType: 'device_status',
        metricName: 'Device Status',
        metricCategory: 'status',
        stringValue: data.status.state || 'unknown',
        measurementTimestamp: timestamp,
        rawData: data.status
      });

      // Errors and warnings
      if (data.status.errors && data.status.errors.length > 0) {
        metrics.push({
          metricType: 'device_errors',
          metricName: 'Device Errors',
          metricCategory: 'error',
          jsonValue: data.status.errors,
          measurementTimestamp: timestamp,
          rawData: { errors: data.status.errors }
        });
      }

      if (data.status.warnings && data.status.warnings.length > 0) {
        metrics.push({
          metricType: 'device_warnings',
          metricName: 'Device Warnings',
          metricCategory: 'error',
          jsonValue: data.status.warnings,
          measurementTimestamp: timestamp,
          rawData: { warnings: data.status.warnings }
        });
      }
    }

    // Paper tray levels
    if (data.paperTrays) {
      data.paperTrays.forEach((tray: any, index: number) => {
        if (tray.level !== undefined) {
          metrics.push({
            metricType: `paper_tray_${index + 1}_level`,
            metricName: `Paper Tray ${index + 1} Level`,
            metricCategory: 'supply',
            numericValue: tray.level,
            unit: tray.unit || 'percent',
            measurementTimestamp: timestamp,
            rawData: tray
          });
        }
      });
    }

    return metrics;
  }

  async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/devices/${deviceId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const device = await this.handleApiResponse(response);
      return this.mapHPDevices([device])[0] || null;
    } catch (error) {
      console.error('Failed to get HP device info:', error);
      return null;
    }
  }

  async updateDeviceConfig(deviceId: string, config: any): Promise<boolean> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/devices/${deviceId}/configuration`,
        {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(config)
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to update HP device config:', error);
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (this.sessionId) {
      headers['X-HP-Session-ID'] = this.sessionId;
    }

    if (this.config.authCredentials?.apiKey) {
      const timestamp = new Date().toISOString();
      const signature = this.generateHMACSignature(timestamp);
      headers['x-hp-hmac-authentication'] = `${this.config.authCredentials.apiKey}:${signature}`;
      headers['x-hp-hmac-date'] = timestamp;
    }

    return headers;
  }

  protected async handleAuthError(): Promise<void> {
    // Clear existing session and re-authenticate
    this.sessionId = undefined;
    this.tokenExpiresAt = undefined;
    
    const success = await this.authenticate();
    if (!success) {
      throw new Error('Re-authentication failed');
    }
  }
}