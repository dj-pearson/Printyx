import * as fs from 'fs';
import * as path from 'path';

export interface DeviceConfig {
  serialNumber?: string;
  ipAddress: string;
  protocol: 'snmp' | 'http' | 'https';
  snmpCommunity?: string;
  snmpVersion?: '1' | '2c' | '3';
  snmpPort?: number;
  httpPort?: number;
  username?: string;
  password?: string;
}

export interface ClientConfig {
  client: {
    id: string;
    name: string;
    version: string;
  };
  api: {
    endpoint: string;
    apiKey: string;
    tenantId: string;
    timeout?: number;
  };
  collection: {
    pollingInterval: number; // seconds
    discoveryEnabled: boolean;
    networkRanges?: string[];
    retryAttempts: number;
    timeout: number; // milliseconds
  };
  devices?: DeviceConfig[];
  alerts?: {
    tonerThreshold: number; // percent
    paperThreshold: number; // percent
  };
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
}

export class ConfigManager {
  private config: ClientConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config.json');
  }

  /**
   * Load configuration from file
   */
  loadConfig(): ClientConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);

      // Validate configuration
      this.validateConfig(this.config!);

      return this.config!;
    } catch (error) {
      throw new Error(
        `Failed to load configuration: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(config: ClientConfig): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.config = config;
    } catch (error) {
      throw new Error(
        `Failed to save configuration: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ClientConfig {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  /**
   * Update configuration values
   */
  updateConfig(updates: Partial<ClientConfig>): void {
    if (!this.config) {
      this.loadConfig();
    }

    this.config = {
      ...this.config!,
      ...updates,
    };

    this.saveConfig(this.config);
  }

  /**
   * Validate configuration structure and required fields
   */
  private validateConfig(config: ClientConfig): void {
    // Validate client section
    if (!config.client) {
      throw new Error('Missing required configuration section: client');
    }
    if (!config.client.id) {
      throw new Error('Missing required field: client.id');
    }
    if (!config.client.name) {
      throw new Error('Missing required field: client.name');
    }

    // Validate API section
    if (!config.api) {
      throw new Error('Missing required configuration section: api');
    }
    if (!config.api.endpoint) {
      throw new Error('Missing required field: api.endpoint');
    }
    if (!config.api.apiKey) {
      throw new Error('Missing required field: api.apiKey');
    }
    if (!config.api.tenantId) {
      throw new Error('Missing required field: api.tenantId');
    }

    // Validate collection section
    if (!config.collection) {
      throw new Error('Missing required configuration section: collection');
    }
    if (
      typeof config.collection.pollingInterval !== 'number' ||
      config.collection.pollingInterval <= 0
    ) {
      throw new Error('Invalid polling interval: must be a positive number');
    }
    if (typeof config.collection.discoveryEnabled !== 'boolean') {
      throw new Error('Invalid discoveryEnabled: must be a boolean');
    }

    // Validate devices if provided
    if (config.devices) {
      if (!Array.isArray(config.devices)) {
        throw new Error('Invalid devices configuration: must be an array');
      }

      for (const device of config.devices) {
        if (!device.ipAddress) {
          throw new Error('Invalid device configuration: missing ipAddress');
        }
        if (!device.protocol) {
          throw new Error('Invalid device configuration: missing protocol');
        }
      }
    }
  }

  /**
   * Generate a sample configuration file
   */
  static generateSampleConfig(outputPath: string): void {
    const sampleConfig: ClientConfig = {
      client: {
        id: 'client-001',
        name: 'Main Office Client',
        version: '1.0.0',
      },
      api: {
        endpoint: 'https://your-printyx-instance.com/api/client-metrics/submit',
        apiKey: 'your-api-key-here',
        tenantId: 'your-tenant-id',
        timeout: 30000,
      },
      collection: {
        pollingInterval: 300, // 5 minutes
        discoveryEnabled: true,
        networkRanges: ['192.168.1.0/24'],
        retryAttempts: 3,
        timeout: 10000,
      },
      devices: [
        {
          ipAddress: '192.168.1.100',
          protocol: 'snmp',
          snmpCommunity: 'public',
          snmpVersion: '2c',
          snmpPort: 161,
        },
      ],
      alerts: {
        tonerThreshold: 15,
        paperThreshold: 20,
      },
      logging: {
        level: 'info',
        file: 'printyx-client.log',
      },
    };

    fs.writeFileSync(outputPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
  }
}
