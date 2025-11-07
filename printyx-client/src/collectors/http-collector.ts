import axios, { AxiosInstance } from 'axios';
import { ICollector, DeviceMetrics } from './collector-interface';
import { getLogger } from '../utils/logger';

export interface HTTPCollectorOptions {
  protocol?: 'http' | 'https';
  port?: number;
  username?: string;
  password?: string;
  timeout?: number;
}

/**
 * HTTP Collector for devices with web interfaces
 * This is a basic implementation that can be extended for specific manufacturers
 */
export class HTTPCollector implements ICollector {
  private logger = getLogger();
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      validateStatus: () => true, // Accept all status codes
    });
  }

  /**
   * Test HTTP connection to a device
   */
  async testConnection(ipAddress: string, options?: HTTPCollectorOptions): Promise<boolean> {
    const opts = this.getDefaultOptions(options);
    const url = `${opts.protocol}://${ipAddress}:${opts.port}`;

    try {
      const response = await this.client.get(url, {
        timeout: opts.timeout,
        auth:
          opts.username && opts.password
            ? {
                username: opts.username,
                password: opts.password,
              }
            : undefined,
      });

      return response.status === 200 || response.status === 401; // 401 means device exists but needs auth
    } catch (error) {
      this.logger.debug(`HTTP connection test failed for ${ipAddress}`, {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Collect metrics from a device via HTTP
   * Note: This is a basic implementation. Production use would require
   * manufacturer-specific endpoints and parsing logic.
   */
  async collect(ipAddress: string, options?: HTTPCollectorOptions): Promise<DeviceMetrics> {
    const opts = this.getDefaultOptions(options);
    this.logger.info(`Collecting metrics from ${ipAddress} via HTTP`);

    try {
      // Try to detect manufacturer and use appropriate endpoints
      const manufacturer = await this.detectManufacturer(ipAddress, opts);

      let metrics: DeviceMetrics;

      if (manufacturer === 'Canon') {
        metrics = await this.collectCanon(ipAddress, opts);
      } else if (manufacturer === 'Xerox') {
        metrics = await this.collectXerox(ipAddress, opts);
      } else if (manufacturer === 'HP') {
        metrics = await this.collectHP(ipAddress, opts);
      } else {
        // Generic collection
        metrics = await this.collectGeneric(ipAddress, opts);
      }

      this.logger.info(`Successfully collected metrics from ${ipAddress}`);
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to collect metrics from ${ipAddress}`, { error });

      return {
        serialNumber: `ERROR-${ipAddress}`,
        ipAddress,
        deviceStatus: 'error',
        errorCodes: [error instanceof Error ? error.message : 'Unknown error'],
        collectionTimestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Detect manufacturer from HTTP response
   */
  private async detectManufacturer(
    ipAddress: string,
    options: HTTPCollectorOptions,
  ): Promise<string | undefined> {
    const url = `${options.protocol}://${ipAddress}:${options.port}`;

    try {
      const response = await this.client.get(url, {
        timeout: options.timeout,
        auth:
          options.username && options.password
            ? {
                username: options.username,
                password: options.password,
              }
            : undefined,
      });

      const html = response.data.toLowerCase();

      if (html.includes('canon')) return 'Canon';
      if (html.includes('xerox')) return 'Xerox';
      if (html.includes('hp') || html.includes('hewlett')) return 'HP';
      if (html.includes('ricoh')) return 'Ricoh';
      if (html.includes('konica')) return 'Konica Minolta';

      return undefined;
    } catch (error) {
      this.logger.debug(`Failed to detect manufacturer for ${ipAddress}`, {
        error: error instanceof Error ? error.message : error,
      });
      return undefined;
    }
  }

  /**
   * Collect metrics from Canon devices
   * Note: Canon devices typically use their REST API or web interface
   */
  private async collectCanon(
    ipAddress: string,
    options: HTTPCollectorOptions,
  ): Promise<DeviceMetrics> {
    // This is a placeholder. Actual implementation would use Canon's specific API
    // Canon imageRUNNER devices typically expose data via:
    // - /eng/property/property.cgi
    // - /ssm/status/statusDisplay.cgi

    this.logger.warn(`Canon HTTP collection not fully implemented for ${ipAddress}`);
    return this.collectGeneric(ipAddress, options);
  }

  /**
   * Collect metrics from Xerox devices
   */
  private async collectXerox(
    ipAddress: string,
    options: HTTPCollectorOptions,
  ): Promise<DeviceMetrics> {
    // Xerox devices typically expose data via:
    // - /status.htm
    // - /properties.dhtml

    this.logger.warn(`Xerox HTTP collection not fully implemented for ${ipAddress}`);
    return this.collectGeneric(ipAddress, options);
  }

  /**
   * Collect metrics from HP devices
   */
  private async collectHP(
    ipAddress: string,
    options: HTTPCollectorOptions,
  ): Promise<DeviceMetrics> {
    // HP devices typically expose data via:
    // - /DevMgmt/ConsumableConfigDyn.xml
    // - /DevMgmt/ProductConfigDyn.xml

    this.logger.warn(`HP HTTP collection not fully implemented for ${ipAddress}`);
    return this.collectGeneric(ipAddress, options);
  }

  /**
   * Generic collection method
   * Returns basic information - users should implement manufacturer-specific methods
   */
  private async collectGeneric(
    ipAddress: string,
    options: HTTPCollectorOptions,
  ): Promise<DeviceMetrics> {
    this.logger.info(
      `Using generic HTTP collection for ${ipAddress} (manufacturer-specific collection not available)`,
    );

    return {
      serialNumber: `HTTP-${ipAddress}`,
      ipAddress,
      deviceStatus: 'unknown',
      errorCodes: ['HTTP collection requires manufacturer-specific implementation'],
      collectionTimestamp: new Date().toISOString(),
      rawData: {
        note: 'Please use SNMP collector for full metrics, or implement manufacturer-specific HTTP endpoints',
      },
    };
  }

  /**
   * Get default options
   */
  private getDefaultOptions(options?: HTTPCollectorOptions): Required<HTTPCollectorOptions> {
    return {
      protocol: options?.protocol || 'http',
      port: options?.port || 80,
      username: options?.username || '',
      password: options?.password || '',
      timeout: options?.timeout || 10000,
    };
  }
}
