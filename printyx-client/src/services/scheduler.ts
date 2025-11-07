import * as cron from 'node-cron';
import { SNMPCollector } from '../collectors/snmp-collector';
import { HTTPCollector } from '../collectors/http-collector';
import { DeviceMetrics } from '../collectors/collector-interface';
import { PrintyxAPIClient } from '../api/printyx-client';
import { ConfigManager, DeviceConfig } from '../config/config-manager';
import { NetworkScanner } from '../discovery/network-scanner';
import { getLogger } from '../utils/logger';

export class MetricsScheduler {
  private logger = getLogger();
  private configManager: ConfigManager;
  private apiClient: PrintyxAPIClient;
  private snmpCollector = new SNMPCollector();
  private httpCollector = new HTTPCollector();
  private networkScanner = new NetworkScanner();

  private collectionTask: cron.ScheduledTask | null = null;
  private heartbeatTask: cron.ScheduledTask | null = null;
  private isCollecting = false;

  constructor(configManager: ConfigManager, apiClient: PrintyxAPIClient) {
    this.configManager = configManager;
    this.apiClient = apiClient;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    const config = this.configManager.getConfig();

    this.logger.info('Starting metrics scheduler', {
      pollingInterval: config.collection.pollingInterval,
      discoveryEnabled: config.collection.discoveryEnabled,
    });

    // Schedule metrics collection
    const collectionCron = this.secondsToCron(config.collection.pollingInterval);
    this.collectionTask = cron.schedule(collectionCron, () => {
      this.collectAndSubmitMetrics();
    });

    // Schedule heartbeat (every 5 minutes)
    this.heartbeatTask = cron.schedule('*/5 * * * *', () => {
      this.sendHeartbeat();
    });

    // Run initial collection immediately
    this.collectAndSubmitMetrics();

    this.logger.info('Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.logger.info('Stopping metrics scheduler');

    if (this.collectionTask) {
      this.collectionTask.stop();
      this.collectionTask = null;
    }

    if (this.heartbeatTask) {
      this.heartbeatTask.stop();
      this.heartbeatTask = null;
    }

    this.logger.info('Scheduler stopped');
  }

  /**
   * Collect metrics from all devices and submit to Printyx
   */
  private async collectAndSubmitMetrics(): Promise<void> {
    if (this.isCollecting) {
      this.logger.warn('Collection already in progress, skipping this cycle');
      return;
    }

    this.isCollecting = true;

    try {
      const config = this.configManager.getConfig();
      const devices = await this.getDevicesToMonitor();

      if (devices.length === 0) {
        this.logger.warn('No devices configured for monitoring');
        return;
      }

      this.logger.info(`Starting metrics collection for ${devices.length} devices`);

      // Collect metrics from all devices
      const metricsPromises = devices.map((device) => this.collectDeviceMetrics(device));
      const metricsResults = await Promise.allSettled(metricsPromises);

      // Extract successful metrics
      const allMetrics: DeviceMetrics[] = metricsResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<DeviceMetrics>).value);

      if (allMetrics.length === 0) {
        this.logger.error('Failed to collect metrics from any device');
        return;
      }

      this.logger.info(`Collected metrics from ${allMetrics.length} devices`);

      // Submit to Printyx
      try {
        const response = await this.apiClient.submitMetrics(
          config.client.id,
          config.client.version,
          allMetrics,
        );

        this.logger.info('Metrics submission complete', {
          processed: response.processed,
          errors: response.errors,
        });

        if (response.errors > 0) {
          this.logger.warn('Some devices had errors during submission', {
            failed: response.details.failed,
          });
        }
      } catch (error) {
        this.logger.error('Failed to submit metrics to Printyx', { error });
      }
    } catch (error) {
      this.logger.error('Error during metrics collection', { error });
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Get list of devices to monitor
   */
  private async getDevicesToMonitor(): Promise<DeviceConfig[]> {
    const config = this.configManager.getConfig();

    // If discovery is enabled, scan for new devices
    if (config.collection.discoveryEnabled && config.collection.networkRanges) {
      try {
        this.logger.info('Running device discovery');
        const discovered = await this.networkScanner.discoverDevices(
          config.collection.networkRanges,
        );

        if (discovered.length > 0) {
          this.logger.info(`Discovered ${discovered.length} new devices`);

          // Add discovered devices to config if not already present
          const existingIPs = new Set((config.devices || []).map((d) => d.ipAddress));
          const newDevices = discovered
            .filter((d) => !existingIPs.has(d.ipAddress))
            .map((d) => ({
              ipAddress: d.ipAddress,
              protocol: d.protocol,
              snmpCommunity: d.protocol === 'snmp' ? 'public' : undefined,
              snmpVersion: d.protocol === 'snmp' ? ('2c' as const) : undefined,
            }));

          if (newDevices.length > 0) {
            config.devices = [...(config.devices || []), ...newDevices];
            this.configManager.saveConfig(config);
            this.logger.info(`Added ${newDevices.length} new devices to configuration`);
          }
        }
      } catch (error) {
        this.logger.error('Discovery failed', { error });
      }
    }

    return config.devices || [];
  }

  /**
   * Collect metrics from a single device
   */
  private async collectDeviceMetrics(device: DeviceConfig): Promise<DeviceMetrics> {
    const config = this.configManager.getConfig();

    try {
      if (device.protocol === 'snmp') {
        return await this.snmpCollector.collect(device.ipAddress, {
          community: device.snmpCommunity || 'public',
          version: this.getSNMPVersion(device.snmpVersion || '2c'),
          port: device.snmpPort || 161,
          timeout: config.collection.timeout,
          retries: config.collection.retryAttempts,
        });
      } else {
        return await this.httpCollector.collect(device.ipAddress, {
          protocol: device.protocol === 'https' ? 'https' : 'http',
          port: device.httpPort || 80,
          username: device.username,
          password: device.password,
          timeout: config.collection.timeout,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to collect from ${device.ipAddress}`, { error });
      throw error;
    }
  }

  /**
   * Send heartbeat to Printyx
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      await this.apiClient.sendHeartbeat();
      this.logger.debug('Heartbeat sent successfully');
    } catch (error) {
      this.logger.error('Failed to send heartbeat', { error });
    }
  }

  /**
   * Convert seconds to cron expression
   */
  private secondsToCron(seconds: number): string {
    if (seconds < 60) {
      // Every N seconds (not standard cron, will use minimum 1 minute)
      return '* * * * *'; // Every minute
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `*/${minutes} * * * *`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `0 */${hours} * * *`;
    }
  }

  /**
   * Get SNMP version enum
   */
  private getSNMPVersion(version: '1' | '2c' | '3'): any {
    const snmp = require('net-snmp');
    switch (version) {
      case '1':
        return snmp.Version1;
      case '2c':
        return snmp.Version2c;
      case '3':
        return snmp.Version3;
      default:
        return snmp.Version2c;
    }
  }
}
