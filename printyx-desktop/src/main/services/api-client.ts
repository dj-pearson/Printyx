import https from 'https';
import log from 'electron-log';

interface OidPreset {
  id: string;
  name: string;
  manufacturer: string;
  model?: string;
  oids: {
    name: string;
    oid: string;
    description: string;
    category: string;
  }[];
}

interface MonitoringData {
  deviceId: string;
  timestamp: string;
  metrics: {
    name: string;
    value: any;
    oid: string;
  }[];
}

export class ApiClient {
  private serverUrl: string;
  private apiKey: string;

  constructor(serverUrl: string, apiKey: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  async getOidPresets(): Promise<OidPreset[]> {
    try {
      const response = await this.fetch('/api/printer-monitoring/oid-presets');
      return response.presets || [];
    } catch (error) {
      log.error('Failed to fetch OID presets:', error);
      throw error;
    }
  }

  async getOidPresetByManufacturer(manufacturer: string): Promise<OidPreset | null> {
    try {
      const presets = await this.getOidPresets();
      return (
        presets.find((p) => p.manufacturer.toLowerCase() === manufacturer.toLowerCase()) || null
      );
    } catch (error) {
      log.error('Failed to fetch OID preset by manufacturer:', error);
      throw error;
    }
  }

  async sendMonitoringData(data: MonitoringData): Promise<void> {
    try {
      await this.fetch('/api/printer-monitoring/metrics', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      log.debug('Monitoring data sent successfully');
    } catch (error) {
      log.error('Failed to send monitoring data:', error);
      throw error;
    }
  }

  async registerDevice(device: {
    ip: string;
    manufacturer: string;
    model: string;
    serialNumber?: string;
    location?: string;
    companyId: string;
    locationId: string;
  }): Promise<{ deviceId: string }> {
    try {
      const response = await this.fetch('/api/printer-monitoring/devices', {
        method: 'POST',
        body: JSON.stringify(device),
      });
      return response;
    } catch (error) {
      log.error('Failed to register device:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetch('/api/health');
      return true;
    } catch (error) {
      log.error('Connection test failed:', error);
      return false;
    }
  }

  private async fetch(
    endpoint: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.serverUrl);

      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers,
        },
      };

      const req = https.request(url, requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (error) {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}
