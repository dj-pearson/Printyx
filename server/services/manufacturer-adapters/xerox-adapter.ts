import { BaseManufacturerAdapter, DeviceInfo, MeterReading, CollectionResult, IntegrationConfig } from './base-adapter';

/**
 * Xerox ConnectKey and Workplace Cloud Integration Adapter
 * Supports Xerox devices through ConnectKey API and Managed Print Services API
 */
export class XeroxAdapter extends BaseManufacturerAdapter {
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: IntegrationConfig) {
    super('xerox', 'Xerox ConnectKey', config);
  }

  async testConnection(): Promise<boolean> {
    try {
      this.validateConfig();
      
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/v1/health`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Xerox connection test failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      if (this.config.authType === 'oauth2') {
        return await this.authenticateOAuth2();
      } else if (this.config.authType === 'api_key') {
        return await this.authenticateApiKey();
      } else {
        throw new Error('Unsupported authentication type for Xerox integration');
      }
    } catch (error) {
      console.error('Xerox authentication failed:', error);
      return false;
    }
  }

  private async authenticateOAuth2(): Promise<boolean> {
    try {
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/oauth/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.config.authCredentials.clientId,
            client_secret: this.config.authCredentials.clientSecret,
            scope: 'device:read meter:read'
          }).toString()
        }
      );

      const data = await this.handleApiResponse(response);
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (data.expires_in * 1000));
      
      return true;
    } catch (error) {
      console.error('Xerox OAuth2 authentication failed:', error);
      return false;
    }
  }

  private async authenticateApiKey(): Promise<boolean> {
    // For Xerox MPS API, API key authentication
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
        `${this.config.apiEndpoint}/v1/devices`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const data = await this.handleApiResponse(response);
      return this.mapXeroxDevices(data.devices || data.printers || []);
    } catch (error) {
      console.error('Xerox device discovery failed:', error);
      return [];
    }
  }

  private mapXeroxDevices(devices: any[]): DeviceInfo[] {
    return devices.map(device => ({
      deviceId: device.deviceId || device.id || device.serialNumber,
      serialNumber: device.serialNumber,
      modelNumber: device.model || device.modelName,
      deviceName: device.name || device.displayName,
      ipAddress: device.ipAddress || device.networkAddress,
      macAddress: device.macAddress,
      capabilities: device.capabilities || ['meter_reading', 'status_monitoring', 'supply_monitoring'],
      supportedMetrics: [
        'total_impressions',
        'black_impressions',
        'color_impressions',
        'total_clicks',
        'simplex_impressions',
        'duplex_impressions',
        'scan_impressions',
        'fax_impressions',
        'toner_black_level',
        'toner_cyan_level',
        'toner_magenta_level',
        'toner_yellow_level',
        'waste_toner_level',
        'drum_black_remaining',
        'drum_color_remaining',
        'fuser_remaining'
      ]
    }));
  }

  async collectDeviceMetrics(deviceId: string): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      // Collect both meter data and supply levels
      const [meterResponse, supplyResponse] = await Promise.all([
        this.makeHttpRequest(
          `${this.config.apiEndpoint}/v1/devices/${deviceId}/meters`,
          {
            method: 'GET',
            headers: this.getAuthHeaders()
          }
        ),
        this.makeHttpRequest(
          `${this.config.apiEndpoint}/v1/devices/${deviceId}/supplies`,
          {
            method: 'GET',
            headers: this.getAuthHeaders()
          }
        )
      ]);

      const meterData = await this.handleApiResponse(meterResponse);
      const supplyData = await this.handleApiResponse(supplyResponse);
      
      const metrics = [
        ...this.mapXeroxMeterData(meterData),
        ...this.mapXeroxSupplyData(supplyData)
      ];
      
      return {
        success: true,
        deviceId,
        metrics,
        rawResponse: { meters: meterData, supplies: supplyData },
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

  private mapXeroxMeterData(data: any): MeterReading[] {
    const metrics: MeterReading[] = [];
    const timestamp = new Date();

    if (data.meters || data.counters) {
      const meters = data.meters || data.counters;
      
      // Total impressions
      if (meters.totalImpressions !== undefined) {
        metrics.push({
          metricType: 'total_impressions',
          metricName: 'Total Impressions',
          metricCategory: 'usage',
          numericValue: meters.totalImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { totalImpressions: meters.totalImpressions }
        });
      }

      // Black impressions
      if (meters.blackImpressions !== undefined) {
        metrics.push({
          metricType: 'black_impressions',
          metricName: 'Black Impressions',
          metricCategory: 'usage',
          numericValue: meters.blackImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { blackImpressions: meters.blackImpressions }
        });
      }

      // Color impressions
      if (meters.colorImpressions !== undefined) {
        metrics.push({
          metricType: 'color_impressions',
          metricName: 'Color Impressions',
          metricCategory: 'usage',
          numericValue: meters.colorImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { colorImpressions: meters.colorImpressions }
        });
      }

      // Scan impressions
      if (meters.scanImpressions !== undefined) {
        metrics.push({
          metricType: 'scan_impressions',
          metricName: 'Scan Impressions',
          metricCategory: 'usage',
          numericValue: meters.scanImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { scanImpressions: meters.scanImpressions }
        });
      }

      // Fax impressions
      if (meters.faxImpressions !== undefined) {
        metrics.push({
          metricType: 'fax_impressions',
          metricName: 'Fax Impressions',
          metricCategory: 'usage',
          numericValue: meters.faxImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { faxImpressions: meters.faxImpressions }
        });
      }

      // Duplex/Simplex
      if (meters.duplexImpressions !== undefined) {
        metrics.push({
          metricType: 'duplex_impressions',
          metricName: 'Duplex Impressions',
          metricCategory: 'usage',
          numericValue: meters.duplexImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { duplexImpressions: meters.duplexImpressions }
        });
      }

      if (meters.simplexImpressions !== undefined) {
        metrics.push({
          metricType: 'simplex_impressions',
          metricName: 'Simplex Impressions',
          metricCategory: 'usage',
          numericValue: meters.simplexImpressions,
          unit: 'impressions',
          measurementTimestamp: timestamp,
          rawData: { simplexImpressions: meters.simplexImpressions }
        });
      }
    }

    return metrics;
  }

  private mapXeroxSupplyData(data: any): MeterReading[] {
    const metrics: MeterReading[] = [];
    const timestamp = new Date();

    if (data.supplies || data.consumables) {
      const supplies = data.supplies || data.consumables;
      
      supplies.forEach((supply: any) => {
        if (supply.type && supply.level !== undefined) {
          const metricType = `${supply.color || supply.type}_level`.toLowerCase();
          
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

    // Alternative supply data structure
    if (data.toner) {
      Object.entries(data.toner).forEach(([color, level]) => {
        if (typeof level === 'number') {
          metrics.push({
            metricType: `toner_${color}_level`,
            metricName: `${color.charAt(0).toUpperCase() + color.slice(1)} Toner Level`,
            metricCategory: 'supply',
            numericValue: level,
            unit: 'percent',
            measurementTimestamp: timestamp,
            rawData: { [color]: level }
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
        `${this.config.apiEndpoint}/v1/devices/${deviceId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const device = await this.handleApiResponse(response);
      return this.mapXeroxDevices([device])[0] || null;
    } catch (error) {
      console.error('Failed to get Xerox device info:', error);
      return null;
    }
  }

  async updateDeviceConfig(deviceId: string, config: any): Promise<boolean> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/v1/devices/${deviceId}/configuration`,
        {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(config)
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to update Xerox device config:', error);
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Xerox-API-Version': this.config.apiVersion || '1.0'
    };

    if (this.accessToken) {
      if (this.config.authType === 'oauth2') {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      } else if (this.config.authType === 'api_key') {
        headers['X-API-Key'] = this.accessToken;
      }
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