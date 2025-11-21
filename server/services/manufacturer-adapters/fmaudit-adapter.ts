import { BaseManufacturerAdapter, DeviceInfo, MeterReading, CollectionResult, IntegrationConfig } from './base-adapter';

/**
 * FMAudit/Printanista Integration Adapter
 * Supports integration with FMAudit/Printanista for automated meter reading
 */
export class FMAuditAdapter extends BaseManufacturerAdapter {
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: IntegrationConfig) {
    super('fmaudit', 'FMAudit/Printanista', config);
  }

  async testConnection(): Promise<boolean> {
    try {
      this.validateConfig();
      
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/status`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('FMAudit connection test failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      if (this.config.authType === 'basic_auth') {
        return await this.authenticateBasicAuth();
      } else if (this.config.authType === 'api_key') {
        return await this.authenticateApiKey();
      } else {
        throw new Error('Unsupported authentication type for FMAudit integration');
      }
    } catch (error) {
      console.error('FMAudit authentication failed:', error);
      return false;
    }
  }

  private async authenticateBasicAuth(): Promise<boolean> {
    try {
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${this.config.authCredentials.username}:${this.config.authCredentials.password}`)}`
          },
          body: JSON.stringify({
            dealer_id: this.config.authCredentials.dealerId
          })
        }
      );

      const data = await this.handleApiResponse(response);
      this.accessToken = data.access_token || data.token;
      this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      return true;
    } catch (error) {
      console.error('FMAudit basic auth failed:', error);
      return false;
    }
  }

  private async authenticateApiKey(): Promise<boolean> {
    // For FMAudit API key authentication
    this.accessToken = this.config.authCredentials.apiKey;
    this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return true;
  }

  async discoverDevices(): Promise<DeviceInfo[]> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/devices`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const data = await this.handleApiResponse(response);
      return this.mapFMAuditDevices(data.devices || data.printers || []);
    } catch (error) {
      console.error('FMAudit device discovery failed:', error);
      return [];
    }
  }

  private mapFMAuditDevices(devices: any[]): DeviceInfo[] {
    return devices.map(device => ({
      deviceId: device.device_id || device.id || device.serial_number,
      serialNumber: device.serial_number,
      modelNumber: device.model || device.model_name,
      deviceName: device.device_name || device.name,
      ipAddress: device.ip_address,
      macAddress: device.mac_address,
      capabilities: device.capabilities || ['meter_reading', 'snmp_monitoring'],
      supportedMetrics: [
        'total_pages',
        'black_pages',
        'color_pages',
        'total_prints',
        'total_copies',
        'total_scans',
        'total_fax',
        'duplex_pages',
        'large_format_pages',
        'device_uptime',
        'toner_coverage'
      ]
    }));
  }

  async collectDeviceMetrics(deviceId: string): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      // FMAudit typically provides meter readings and device status
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/devices/${deviceId}/meters`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const data = await this.handleApiResponse(response);
      const metrics = this.mapFMAuditMetrics(data);
      
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

  private mapFMAuditMetrics(data: any): MeterReading[] {
    const metrics: MeterReading[] = [];
    const timestamp = new Date(data.reading_date || Date.now());

    // FMAudit meter structure
    if (data.meters || data.counters) {
      const meters = data.meters || data.counters;
      
      // Total pages
      if (meters.total_pages !== undefined) {
        metrics.push({
          metricType: 'total_pages',
          metricName: 'Total Pages',
          metricCategory: 'usage',
          numericValue: meters.total_pages,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { total_pages: meters.total_pages }
        });
      }

      // Black pages
      if (meters.black_pages !== undefined || meters.mono_pages !== undefined) {
        const value = meters.black_pages || meters.mono_pages;
        metrics.push({
          metricType: 'black_pages',
          metricName: 'Black/Mono Pages',
          metricCategory: 'usage',
          numericValue: value,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { black_pages: value }
        });
      }

      // Color pages
      if (meters.color_pages !== undefined) {
        metrics.push({
          metricType: 'color_pages',
          metricName: 'Color Pages',
          metricCategory: 'usage',
          numericValue: meters.color_pages,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { color_pages: meters.color_pages }
        });
      }

      // Print counts
      if (meters.total_prints !== undefined) {
        metrics.push({
          metricType: 'total_prints',
          metricName: 'Total Prints',
          metricCategory: 'usage',
          numericValue: meters.total_prints,
          unit: 'prints',
          measurementTimestamp: timestamp,
          rawData: { total_prints: meters.total_prints }
        });
      }

      // Copy counts
      if (meters.total_copies !== undefined) {
        metrics.push({
          metricType: 'total_copies',
          metricName: 'Total Copies',
          metricCategory: 'usage',
          numericValue: meters.total_copies,
          unit: 'copies',
          measurementTimestamp: timestamp,
          rawData: { total_copies: meters.total_copies }
        });
      }

      // Scan counts
      if (meters.total_scans !== undefined) {
        metrics.push({
          metricType: 'total_scans',
          metricName: 'Total Scans',
          metricCategory: 'usage',
          numericValue: meters.total_scans,
          unit: 'scans',
          measurementTimestamp: timestamp,
          rawData: { total_scans: meters.total_scans }
        });
      }

      // Fax counts
      if (meters.total_fax !== undefined) {
        metrics.push({
          metricType: 'total_fax',
          metricName: 'Total Fax',
          metricCategory: 'usage',
          numericValue: meters.total_fax,
          unit: 'fax',
          measurementTimestamp: timestamp,
          rawData: { total_fax: meters.total_fax }
        });
      }

      // Duplex pages
      if (meters.duplex_pages !== undefined) {
        metrics.push({
          metricType: 'duplex_pages',
          metricName: 'Duplex Pages',
          metricCategory: 'usage',
          numericValue: meters.duplex_pages,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { duplex_pages: meters.duplex_pages }
        });
      }

      // Large format pages (for wide format printers)
      if (meters.large_format_pages !== undefined) {
        metrics.push({
          metricType: 'large_format_pages',
          metricName: 'Large Format Pages',
          metricCategory: 'usage',
          numericValue: meters.large_format_pages,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { large_format_pages: meters.large_format_pages }
        });
      }
    }

    // Device status and health
    if (data.device_status) {
      metrics.push({
        metricType: 'device_status',
        metricName: 'Device Status',
        metricCategory: 'status',
        stringValue: data.device_status.status || 'unknown',
        measurementTimestamp: timestamp,
        rawData: data.device_status
      });

      // Device uptime
      if (data.device_status.uptime !== undefined) {
        metrics.push({
          metricType: 'device_uptime',
          metricName: 'Device Uptime',
          metricCategory: 'status',
          numericValue: data.device_status.uptime,
          unit: 'hours',
          measurementTimestamp: timestamp,
          rawData: { uptime: data.device_status.uptime }
        });
      }
    }

    // Toner coverage data (if available)
    if (data.toner_coverage) {
      Object.entries(data.toner_coverage).forEach(([color, coverage]) => {
        if (typeof coverage === 'number') {
          metrics.push({
            metricType: `toner_coverage_${color}`,
            metricName: `${color.charAt(0).toUpperCase() + color.slice(1)} Toner Coverage`,
            metricCategory: 'usage',
            numericValue: coverage,
            unit: 'percent',
            measurementTimestamp: timestamp,
            rawData: { [`toner_coverage_${color}`]: coverage }
          });
        }
      });
    }

    // Error information
    if (data.errors && data.errors.length > 0) {
      metrics.push({
        metricType: 'device_errors',
        metricName: 'Device Errors',
        metricCategory: 'error',
        jsonValue: data.errors,
        measurementTimestamp: timestamp,
        rawData: { errors: data.errors }
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
        `${this.config.apiEndpoint}/api/devices/${deviceId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const device = await this.handleApiResponse(response);
      return this.mapFMAuditDevices([device])[0] || null;
    } catch (error) {
      console.error('Failed to get FMAudit device info:', error);
      return null;
    }
  }

  async updateDeviceConfig(deviceId: string, config: any): Promise<boolean> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/devices/${deviceId}/config`,
        {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(config)
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to update FMAudit device config:', error);
      return false;
    }
  }

  /**
   * Get meter readings for multiple devices (batch operation)
   */
  async getBatchMeterReadings(deviceIds: string[]): Promise<CollectionResult[]> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/devices/meters/batch`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            device_ids: deviceIds,
            include_status: true
          })
        }
      );

      const data = await this.handleApiResponse(response);
      const results: CollectionResult[] = [];

      if (data.devices) {
        data.devices.forEach((deviceData: any) => {
          const metrics = this.mapFMAuditMetrics(deviceData);
          results.push({
            success: true,
            deviceId: deviceData.device_id,
            metrics,
            rawResponse: deviceData
          });
        });
      }

      return results;
    } catch (error) {
      console.error('FMAudit batch meter reading failed:', error);
      return deviceIds.map(deviceId => ({
        success: false,
        deviceId,
        metrics: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (this.accessToken) {
      if (this.config.authType === 'basic_auth') {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      } else if (this.config.authType === 'api_key') {
        headers['X-API-Key'] = this.accessToken;
      }
    }

    if (this.config.authCredentials?.dealerId) {
      headers['X-Dealer-ID'] = this.config.authCredentials.dealerId;
    }

    return headers;
  }

  protected async handleAuthError(): Promise<void> {
    // Clear existing token and re-authenticate
    this.accessToken = undefined;
    this.tokenExpiresAt = undefined;
    
    const success = await this.authenticate();
    if (!success) {
      throw new Error('Re-authentication failed');
    }
  }
}