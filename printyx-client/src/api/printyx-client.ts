import axios, { AxiosInstance, AxiosError } from 'axios';
import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import { DeviceMetrics } from '../collectors/collector-interface';
import { getLogger } from '../utils/logger';

export interface PrintyxClientConfig {
  endpoint: string;
  apiKey: string;
  tenantId: string;
  timeout?: number;
  // Security options
  security?: {
    rejectUnauthorized?: boolean; // Reject self-signed certificates (default: true)
    minTLSVersion?: string; // Minimum TLS version (default: TLSv1.2)
    certificatePinning?: {
      enabled: boolean;
      fingerprints?: string[]; // SHA-256 fingerprints of allowed certificates
      publicKeys?: string[]; // Public keys in PEM format
    };
    customCA?: string; // Path to custom CA certificate file
  };
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

    // Enforce HTTPS
    if (!config.endpoint.startsWith('https://')) {
      throw new Error(
        'Security Error: Only HTTPS endpoints are allowed. HTTP is not secure for production use.',
      );
    }

    // Create secure HTTPS agent
    const httpsAgent = this.createSecureAgent(config);

    this.client = axios.create({
      baseURL: config.endpoint.replace(/\/api\/client-metrics\/submit$/, ''),
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-Tenant-ID': config.tenantId,
        'User-Agent': 'Printyx-Client/1.0',
      },
      httpsAgent,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleError(error);
        return Promise.reject(error);
      },
    );

    this.logger.info('Secure API client initialized', {
      endpoint: config.endpoint,
      tlsVersion: config.security?.minTLSVersion || 'TLSv1.2',
      certificatePinning: config.security?.certificatePinning?.enabled || false,
    });
  }

  /**
   * Create secure HTTPS agent with TLS enforcement and certificate validation
   */
  private createSecureAgent(config: PrintyxClientConfig): https.Agent {
    const securityConfig = config.security || {};

    // Default security settings
    const rejectUnauthorized = securityConfig.rejectUnauthorized !== false; // Default: true
    const minVersion = (securityConfig.minTLSVersion || 'TLSv1.2') as tls.SecureVersion;

    // Load custom CA if provided
    let ca: Buffer[] | undefined;
    if (securityConfig.customCA) {
      try {
        ca = [fs.readFileSync(securityConfig.customCA)];
        this.logger.info('Loaded custom CA certificate');
      } catch (error) {
        this.logger.error('Failed to load custom CA certificate', { error });
        throw new Error(`Failed to load custom CA certificate: ${error}`);
      }
    }

    const agentOptions: https.AgentOptions = {
      rejectUnauthorized,
      minVersion,
      maxVersion: 'TLSv1.3' as tls.SecureVersion,
      ca,
      // Disable insecure TLS renegotiation
      secureOptions:
        require('constants').SSL_OP_NO_TLSv1 |
        require('constants').SSL_OP_NO_TLSv1_1 |
        require('constants').SSL_OP_NO_SSLv2 |
        require('constants').SSL_OP_NO_SSLv3,
    };

    // Add certificate pinning if enabled
    if (securityConfig.certificatePinning?.enabled) {
      this.logger.info('Certificate pinning enabled');

      agentOptions.checkServerIdentity = (hostname: string, cert: any) => {
        // First, do standard hostname verification
        const err = tls.checkServerIdentity(hostname, cert);
        if (err) {
          return err;
        }

        // Then check certificate pinning
        const pinning = securityConfig.certificatePinning!;

        // Check fingerprint pinning
        if (pinning.fingerprints && pinning.fingerprints.length > 0) {
          const fingerprint = cert.fingerprint256.replace(/:/g, '').toLowerCase();
          const allowed = pinning.fingerprints.some(
            (fp) => fp.replace(/:/g, '').toLowerCase() === fingerprint,
          );

          if (!allowed) {
            this.logger.error('Certificate fingerprint does not match pinned fingerprints', {
              actual: cert.fingerprint256,
              expected: pinning.fingerprints,
            });
            return new Error('Certificate fingerprint does not match pinned fingerprints');
          }
        }

        // Check public key pinning
        if (pinning.publicKeys && pinning.publicKeys.length > 0) {
          const publicKey = cert.pubkey.toString('base64');
          const allowed = pinning.publicKeys.some((pk) => pk === publicKey);

          if (!allowed) {
            this.logger.error('Certificate public key does not match pinned keys');
            return new Error('Certificate public key does not match pinned keys');
          }
        }

        return undefined; // Valid certificate
      };
    }

    return new https.Agent(agentOptions);
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
