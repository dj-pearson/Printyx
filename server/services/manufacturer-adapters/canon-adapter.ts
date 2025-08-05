import { BaseManufacturerAdapter, DeviceInfo, MeterReading, CollectionResult, IntegrationConfig } from './base-adapter';

/**
 * Canon Data Collection Agent (DCA) and eMaintenance Integration Adapter
 * Supports Canon imageRUNNER ADVANCE devices through Canon's APIs
 */
export class CanonAdapter extends BaseManufacturerAdapter {
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: IntegrationConfig) {
    super('canon', 'Canon Data Collection Agent', config);
  }

  async testConnection(): Promise<boolean> {
    try {
      this.validateConfig();
      
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/health`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('Canon connection test failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // Canon DCA typically uses certificate-based authentication or API keys
      if (this.config.authType === 'certificate') {
        return await this.authenticateWithCertificate();
      } else if (this.config.authType === 'api_key') {
        return await this.authenticateWithApiKey();
      } else {
        throw new Error('Unsupported authentication type for Canon integration');
      }
    } catch (error) {
      console.error('Canon authentication failed:', error);
      return false;
    }
  }

  private async authenticateWithCertificate(): Promise<boolean> {
    // Certificate-based authentication for Canon DCA
    // This would typically involve setting up SSL client certificates
    // For now, we'll simulate successful authentication
    this.accessToken = 'canon_cert_token';
    this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return true;
  }

  private async authenticateWithApiKey(): Promise<boolean> {
    try {
      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/auth/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.config.authCredentials.apiKey,
            clientId: this.config.authCredentials.clientId
          })
        }
      );

      const data = await this.handleApiResponse(response);
      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (data.expires_in * 1000));
      
      return true;
    } catch (error) {
      console.error('Canon API key authentication failed:', error);
      return false;
    }
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
      return this.mapCanonDevices(data.devices || []);
    } catch (error) {
      console.error('Canon device discovery failed:', error);
      return [];
    }
  }

  private mapCanonDevices(devices: any[]): DeviceInfo[] {
    return devices.map(device => ({
      deviceId: device.device_id || device.id,
      serialNumber: device.serial_number,
      modelNumber: device.model || device.model_name,
      deviceName: device.name || device.device_name,
      ipAddress: device.ip_address,
      macAddress: device.mac_address,
      capabilities: device.capabilities || ['meter_reading', 'status_monitoring'],
      supportedMetrics: [
        'total_prints',
        'black_white_prints', 
        'color_prints',
        'total_copies',
        'black_white_copies',
        'color_copies',
        'total_scans',
        'total_fax',
        'toner_black_level',
        'toner_cyan_level',
        'toner_magenta_level',
        'toner_yellow_level',
        'paper_level',
        'drum_life_remaining'
      ]
    }));
  }

  async collectDeviceMetrics(deviceId: string): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/devices/${deviceId}/meters`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      const data = await this.handleApiResponse(response);
      const metrics = this.mapCanonMetrics(data);
      
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

  private mapCanonMetrics(data: any): MeterReading[] {
    const metrics: MeterReading[] = [];
    const timestamp = new Date();

    // Map Canon-specific meter data to standard format
    if (data.counters) {
      // Print counters
      if (data.counters.total_prints !== undefined) {
        metrics.push({
          metricType: 'total_prints',
          metricName: 'Total Print Count',
          metricCategory: 'usage',
          numericValue: data.counters.total_prints,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { total_prints: data.counters.total_prints }
        });
      }

      if (data.counters.bw_prints !== undefined) {
        metrics.push({
          metricType: 'black_white_prints',
          metricName: 'Black & White Print Count',
          metricCategory: 'usage',
          numericValue: data.counters.bw_prints,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { bw_prints: data.counters.bw_prints }
        });
      }

      if (data.counters.color_prints !== undefined) {
        metrics.push({
          metricType: 'color_prints',
          metricName: 'Color Print Count',
          metricCategory: 'usage',
          numericValue: data.counters.color_prints,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { color_prints: data.counters.color_prints }
        });
      }

      // Copy counters
      if (data.counters.total_copies !== undefined) {
        metrics.push({
          metricType: 'total_copies',
          metricName: 'Total Copy Count',
          metricCategory: 'usage',
          numericValue: data.counters.total_copies,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { total_copies: data.counters.total_copies }
        });
      }

      // Scan counters
      if (data.counters.total_scans !== undefined) {
        metrics.push({
          metricType: 'total_scans',
          metricName: 'Total Scan Count',
          metricCategory: 'usage',
          numericValue: data.counters.total_scans,
          unit: 'pages',
          measurementTimestamp: timestamp,
          rawData: { total_scans: data.counters.total_scans }
        });
      }
    }

    // Supply levels
    if (data.supplies) {
      Object.entries(data.supplies).forEach(([supply, level]) => {
        if (typeof level === 'number') {
          metrics.push({
            metricType: `toner_${supply}_level`,
            metricName: `${supply.charAt(0).toUpperCase() + supply.slice(1)} Toner Level`,
            metricCategory: 'supply',
            numericValue: level,
            unit: 'percent',
            measurementTimestamp: timestamp,
            rawData: { [supply]: level }
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
      return this.mapCanonDevices([device])[0] || null;
    } catch (error) {
      console.error('Failed to get Canon device info:', error);
      return null;
    }
  }

  async updateDeviceConfig(deviceId: string, config: any): Promise<boolean> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Authentication failed');
      }

      const response = await this.makeHttpRequest(
        `${this.config.apiEndpoint}/api/v1/devices/${deviceId}/config`,
        {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(config)
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to update Canon device config:', error);
      return false;
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Canon-API-Version': this.config.apiVersion || '1.0'
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (this.config.authCredentials?.apiKey) {
      headers['X-API-Key'] = this.config.authCredentials.apiKey;
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