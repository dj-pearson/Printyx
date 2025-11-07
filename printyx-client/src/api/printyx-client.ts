import axios, { AxiosInstance, AxiosError } from 'axios';
import { DeviceMetrics } from '../collectors/collector-interface';
import { getLogger } from '../utils/logger';

export interface PrintyxClientConfig {
  endpoint: string;
  apiKey: string;
  tenantId: string;
  timeout?: number;
}

export interface SubmissionResponse {
  message: string;
  processed: number;
  errors: number;
  details: {
    successful: Array<{ serialNumber: string; status: string }>;
    failed: Array<{ serialNumber: string; error: string }>;
  };
}

export interface HeartbeatResponse {
  message: string;
  serverTime: string;
}

export interface ClientConfigResponse {
  clientId: string;
  clientName: string;
  configuration: any;
  status: string;
}

export class PrintyxAPIClient {
  private logger = getLogger();
  private client: AxiosInstance;
  private config: PrintyxClientConfig;

  constructor(config: PrintyxClientConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.endpoint.replace(/\/api\/client-metrics\/submit$/, ''),
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-Tenant-ID': config.tenantId,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleError(error);
        return Promise.reject(error);
      },
    );
  }

  /**
   * Submit device metrics to Printyx platform
   */
  async submitMetrics(
    clientId: string,
    clientVersion: string,
    devices: DeviceMetrics[],
  ): Promise<SubmissionResponse> {
    this.logger.info(`Submitting metrics for ${devices.length} devices to Printyx`);

    try {
      const payload = {
        clientId,
        clientVersion,
        timestamp: new Date().toISOString(),
        devices,
      };

      const response = await this.client.post<SubmissionResponse>(
        '/api/client-metrics/submit',
        payload,
      );

      this.logger.info(
        `Successfully submitted metrics: ${response.data.processed} processed, ${response.data.errors} errors`,
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to submit metrics', { error });
      throw error;
    }
  }

  /**
   * Send heartbeat to Printyx platform
   */
  async sendHeartbeat(): Promise<HeartbeatResponse> {
    this.logger.debug('Sending heartbeat to Printyx');

    try {
      const response = await this.client.post<HeartbeatResponse>(
        '/api/client-metrics/heartbeat',
        {},
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to send heartbeat', { error });
      throw error;
    }
  }

  /**
   * Get client configuration from Printyx platform
   */
  async getConfig(): Promise<ClientConfigResponse> {
    this.logger.debug('Fetching client configuration from Printyx');

    try {
      const response = await this.client.get<ClientConfigResponse>('/api/client-metrics/config');

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch client configuration', { error });
      throw error;
    }
  }

  /**
   * Test connection to Printyx platform
   */
  async testConnection(): Promise<boolean> {
    this.logger.info('Testing connection to Printyx platform');

    try {
      await this.sendHeartbeat();
      this.logger.info('Connection test successful');
      return true;
    } catch (error) {
      this.logger.error('Connection test failed', { error });
      return false;
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      if (status === 401) {
        this.logger.error('Authentication failed: Invalid API key or tenant ID');
      } else if (status === 403) {
        this.logger.error('Access forbidden: Client may be inactive');
      } else if (status === 500) {
        this.logger.error('Server error', { message: data.message });
      } else {
        this.logger.error(`API error: ${status}`, { data });
      }
    } else if (error.request) {
      // Request made but no response received
      this.logger.error('No response from server - check network connection and endpoint URL');
    } else {
      // Error in request setup
      this.logger.error('Request error', { message: error.message });
    }
  }

  /**
   * Update API key
   */
  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    this.logger.info('API key updated');
  }

  /**
   * Update tenant ID
   */
  updateTenantId(tenantId: string): void {
    this.config.tenantId = tenantId;
    this.client.defaults.headers.common['X-Tenant-ID'] = tenantId;
    this.logger.info('Tenant ID updated');
  }
}
