/**
 * Base adapter class for manufacturer integrations
 * Provides common functionality for all manufacturer-specific adapters
 */

export interface DeviceInfo {
  deviceId: string;
  serialNumber?: string;
  modelNumber?: string;
  deviceName?: string;
  ipAddress?: string;
  macAddress?: string;
  capabilities?: string[];
  supportedMetrics?: string[];
}

export interface MeterReading {
  metricType: string;
  metricName: string;
  metricCategory: 'usage' | 'supply' | 'maintenance' | 'error' | 'status';
  numericValue?: number;
  stringValue?: string;
  booleanValue?: boolean;
  jsonValue?: any;
  unit?: string;
  measurementTimestamp: Date;
  rawData?: any;
}

export interface IntegrationConfig {
  apiEndpoint?: string;
  apiVersion?: string;
  authType?: 'oauth2' | 'api_key' | 'basic_auth' | 'certificate';
  authCredentials?: any;
  settings?: any;
  fieldMappings?: any;
}

export interface CollectionResult {
  success: boolean;
  deviceId: string;
  metrics: MeterReading[];
  error?: string;
  rawResponse?: any;
  responseTimeMs?: number;
}

export abstract class BaseManufacturerAdapter {
  protected config: IntegrationConfig;
  protected manufacturer: string;
  protected platformName: string;

  constructor(manufacturer: string, platformName: string, config: IntegrationConfig) {
    this.manufacturer = manufacturer;
    this.platformName = platformName;
    this.config = config;
  }

  /**
   * Test the connection to the manufacturer's API
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Authenticate with the manufacturer's API
   */
  abstract authenticate(): Promise<boolean>;

  /**
   * Discover devices available for monitoring
   */
  abstract discoverDevices(): Promise<DeviceInfo[]>;

  /**
   * Collect meter readings from a specific device
   */
  abstract collectDeviceMetrics(deviceId: string): Promise<CollectionResult>;

  /**
   * Collect meter readings from multiple devices
   */
  async collectMultipleDeviceMetrics(deviceIds: string[]): Promise<CollectionResult[]> {
    const results: CollectionResult[] = [];
    
    for (const deviceId of deviceIds) {
      try {
        const result = await this.collectDeviceMetrics(deviceId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          deviceId,
          metrics: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  /**
   * Get device details
   */
  abstract getDeviceInfo(deviceId: string): Promise<DeviceInfo | null>;

  /**
   * Update device configuration
   */
  abstract updateDeviceConfig(deviceId: string, config: any): Promise<boolean>;

  /**
   * Handle authentication errors and refresh tokens if needed
   */
  protected async handleAuthError(): Promise<void> {
    // Base implementation - override in specific adapters
    throw new Error('Authentication failed');
  }

  /**
   * Map manufacturer-specific field names to our standard schema
   */
  protected mapFields(rawData: any): MeterReading[] {
    const mappings = this.config.fieldMappings || {};
    const metrics: MeterReading[] = [];

    // Base implementation - override in specific adapters for custom field mapping
    Object.entries(rawData).forEach(([key, value]) => {
      const mappedField = mappings[key] || key;
      
      if (this.isValidMetricValue(value)) {
        metrics.push({
          metricType: mappedField,
          metricName: mappedField,
          metricCategory: this.categorizeMetric(mappedField),
          numericValue: typeof value === 'number' ? value : undefined,
          stringValue: typeof value === 'string' ? value : undefined,
          booleanValue: typeof value === 'boolean' ? value : undefined,
          jsonValue: typeof value === 'object' ? value : undefined,
          measurementTimestamp: new Date(),
          rawData: { [key]: value }
        });
      }
    });

    return metrics;
  }

  /**
   * Categorize metrics based on metric type
   */
  protected categorizeMetric(metricType: string): 'usage' | 'supply' | 'maintenance' | 'error' | 'status' {
    const type = metricType.toLowerCase();
    
    if (type.includes('print') || type.includes('copy') || type.includes('scan') || type.includes('page') || type.includes('count')) {
      return 'usage';
    }
    
    if (type.includes('toner') || type.includes('ink') || type.includes('paper') || type.includes('supply') || type.includes('level')) {
      return 'supply';
    }
    
    if (type.includes('maintenance') || type.includes('clean') || type.includes('service') || type.includes('drum')) {
      return 'maintenance';
    }
    
    if (type.includes('error') || type.includes('jam') || type.includes('fault') || type.includes('warning')) {
      return 'error';
    }
    
    return 'status';
  }

  /**
   * Check if a value is valid for metrics collection
   */
  protected isValidMetricValue(value: any): boolean {
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Make HTTP request with error handling and retries
   */
  protected async makeHttpRequest(
    url: string, 
    options: RequestInit, 
    retries: number = 3
  ): Promise<Response> {
    let lastError: Error;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Printyx-Integration/1.0',
            ...options.headers
          }
        });
        
        if (response.status === 401) {
          await this.handleAuthError();
          continue; // Retry with new auth
        }
        
        if (response.status === 429) {
          // Rate limited - wait and retry
          await this.sleep(Math.pow(2, i) * 1000);
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (i < retries - 1) {
          await this.sleep(Math.pow(2, i) * 1000); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Sleep utility for retries and rate limiting
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate configuration
   */
  protected validateConfig(): boolean {
    if (!this.config.apiEndpoint) {
      throw new Error('API endpoint is required');
    }
    
    if (!this.config.authCredentials) {
      throw new Error('Authentication credentials are required');
    }
    
    return true;
  }

  /**
   * Get authentication headers
   */
  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    switch (this.config.authType) {
      case 'api_key':
        headers['Authorization'] = `Bearer ${this.config.authCredentials.apiKey}`;
        break;
      case 'basic_auth':
        const credentials = btoa(`${this.config.authCredentials.username}:${this.config.authCredentials.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
        break;
      case 'oauth2':
        headers['Authorization'] = `Bearer ${this.config.authCredentials.accessToken}`;
        break;
    }
    
    return headers;
  }

  /**
   * Standard error handling for API responses
   */
  protected async handleApiResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }
}