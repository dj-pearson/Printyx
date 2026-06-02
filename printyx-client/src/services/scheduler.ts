import * as cron from 'node-cron';
import { SNMPCollector } from '../collectors/snmp-collector';
import { HTTPCollector } from '../collectors/http-collector';
import { DeviceMetrics } from '../collectors/collector-interface';
import { PrintyxAPIClient } from '../api/printyx-client';
import { ConfigManager, DeviceConfig } from '../config/config-manager';
import { NetworkScanner } from '../discovery/network-scanner';
import { DataBuffer } from './data-buffer';
import { MeterTracker } from './meter-tracker';
import { CommandProcessor } from './command-processor';
import { UpdateManager } from './update-manager';
import { getLogger } from '../utils/logger';

export class MetricsScheduler {
  private logger = getLogger();
  private configManager: ConfigManager;
  private apiClient: PrintyxAPIClient;
  private snmpCollector = new SNMPCollector();
  private httpCollector = new HTTPCollector();
  private networkScanner = new NetworkScanner();
  private dataBuffer: DataBuffer;
  private meterTracker: MeterTracker;
  private commandProcessor: CommandProcessor;
  private updateManager: UpdateManager;

  private collectionTask: cron.ScheduledTask | null = null;
  private heartbeatTask: cron.ScheduledTask | null = null;
  private retryTask: cron.ScheduledTask | null = null;
  private isCollecting = false;
  private currentPollingCron: string | null = null;

  constructor(configManager: ConfigManager, apiClient: PrintyxAPIClient) {
    this.configManager = configManager;
    this.apiClient = apiClient;
    this.dataBuffer = new DataBuffer();
    this.meterTracker = new MeterTracker();
    this.commandProcessor = new CommandProcessor(apiClient, configManager, {
      forceSubmit: () => this.handleForceSubmit(),
      rescan: () => this.handleRescan(),
      reloadConfig: () => this.handleReloadConfig(),
    });
    this.updateManager = new UpdateManager(apiClient, configManager);
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
    this.currentPollingCron = collectionCron;
    this.collectionTask = cron.schedule(collectionCron, () => {
      this.collectAndSubmitMetrics();
    });

    // Schedule heartbeat (every 5 minutes)
    this.heartbeatTask = cron.schedule('*/5 * * * *', () => {
      this.sendHeartbeat();
    });

    // Schedule retry of buffered submissions (every minute)
    this.retryTask = cron.schedule('* * * * *', () => {
      this.retryBufferedSubmissions();
    });

    // Process any buffered submissions from previous runs
    this.retryBufferedSubmissions();

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

    if (this.retryTask) {
      this.retryTask.stop();
      this.retryTask = null;
    }

    // Log buffer stats before stopping
    const bufferStats = this.dataBuffer.getStats();
    if (bufferStats.totalSubmissions > 0) {
      this.logger.warn(`Shutting down with ${bufferStats.totalSubmissions} submissions in buffer`);
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
      const rawMetrics: DeviceMetrics[] = metricsResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<DeviceMetrics>).value);

      if (rawMetrics.length === 0) {
        this.logger.error('Failed to collect metrics from any device');
        return;
      }

      this.logger.info(`Collected metrics from ${rawMetrics.length} devices`);

      // Process through meter tracker for accuracy
      const processedMetrics = rawMetrics.map((metrics) =>
        this.meterTracker.processMetrics(metrics),
      );

      // Log toner alerts
      for (const metrics of processedMetrics) {
        if (metrics.tonerAlerts && metrics.tonerAlerts.length > 0) {
          for (const alert of metrics.tonerAlerts) {
            this.logger.warn(`Toner Alert: ${alert.message}`, {
              device: metrics.serialNumber,
              severity: alert.severity,
              shouldOrder: alert.shouldOrder,
            });
          }
        }

        if (metrics.hasRollover) {
          this.logger.warn(`Counter rollover detected`, {
            device: metrics.serialNumber,
            differential: metrics.differential,
          });
        }

        if (metrics.isDuplicate) {
          this.logger.info(`Duplicate reading skipped (no change since last reading)`, {
            device: metrics.serialNumber,
          });
        }
      }

      // Filter out duplicates for submission
      const metricsToSubmit = processedMetrics.filter((m) => !m.isDuplicate);

      if (metricsToSubmit.length === 0) {
        this.logger.info('No new metrics to submit (all duplicates)');
        return;
      }

      // Try to submit to Printyx
      try {
        const response = await this.apiClient.submitMetrics(
          config.client.id,
          config.client.version,
          metricsToSubmit,
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
        // Failed to submit - add to buffer for retry
        this.logger.error('Failed to submit metrics to Printyx, adding to buffer', { error });
        this.dataBuffer.add(config.client.id, config.client.version, metricsToSubmit);

        const bufferStats = this.dataBuffer.getStats();
        this.logger.info('Metrics buffered for retry', {
          bufferSize: bufferStats.totalSubmissions,
          totalDevices: bufferStats.totalDevices,
        });
      }
    } catch (error) {
      this.logger.error('Error during metrics collection', { error });
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * One-shot post-install verification. Runs discovery + a single collect
   * cycle, submits whatever it found (so the dashboard populates right away),
   * and returns counts the installer/platform can show the operator. Does NOT
   * touch the cron schedule — safe to call before start() or standalone.
   */
  async runSelfTest(): Promise<{
    printersFound: number;
    printersReporting: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const devices = await this.getDevicesToMonitor();
    if (devices.length === 0) {
      return {
        printersFound: 0,
        printersReporting: 0,
        errors: ['No printers discovered or configured on this network.'],
      };
    }

    const results = await Promise.allSettled(devices.map((d) => this.collectDeviceMetrics(d)));
    const collected: DeviceMetrics[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        collected.push(r.value);
      } else {
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`${devices[i].ipAddress}: ${reason}`);
      }
    });

    if (collected.length > 0) {
      const config = this.configManager.getConfig();
      const processed = collected.map((m) => this.meterTracker.processMetrics(m));
      try {
        await this.apiClient.submitMetrics(config.client.id, config.client.version, processed);
      } catch (e) {
        errors.push(`submit: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return {
      printersFound: devices.length,
      printersReporting: collected.length,
      errors,
    };
  }

  /**
   * Retry buffered submissions with exponential backoff
   */
  private async retryBufferedSubmissions(): Promise<void> {
    const readyForRetry = this.dataBuffer.getReadyForRetry();

    if (readyForRetry.length === 0) {
      return;
    }

    this.logger.info(`Attempting to retry ${readyForRetry.length} buffered submissions`);

    for (const submission of readyForRetry) {
      try {
        this.dataBuffer.markAttempted(submission.id);

        const response = await this.apiClient.submitMetrics(
          submission.clientId,
          submission.clientVersion,
          submission.devices,
        );

        this.logger.info('Buffered submission successful', {
          id: submission.id,
          attempts: submission.attempts + 1,
          processed: response.processed,
        });

        // Remove from buffer on success
        this.dataBuffer.remove(submission.id);
      } catch (error) {
        this.logger.warn('Buffered submission failed, will retry later', {
          id: submission.id,
          attempts: submission.attempts + 1,
          error: error instanceof Error ? error.message : error,
        });

        // Will be retried with exponential backoff
      }
    }

    const bufferStats = this.dataBuffer.getStats();
    if (bufferStats.totalSubmissions > 0) {
      this.logger.info('Buffer status', bufferStats);
    }
  }

  /**
   * Get list of devices to monitor
   */
  private async getDevicesToMonitor(): Promise<DeviceConfig[]> {
    const config = this.configManager.getConfig();

    // If discovery is enabled, scan for new devices. By default we use
    // mDNS + WSD (cheap, intra-LAN multicast, near-instant) and fall back
    // to CIDR only when the operator explicitly asks for it.
    const methods =
      config.collection.discoveryMethods && config.collection.discoveryMethods.length > 0
        ? config.collection.discoveryMethods
        : ['mdns' as const, 'wsd' as const];
    const ranges = config.collection.networkRanges || [];
    const wantsScan =
      config.collection.discoveryEnabled &&
      (methods.includes('mdns') ||
        methods.includes('wsd') ||
        methods.includes('all') ||
        (methods.includes('cidr') && ranges.length > 0));
    if (wantsScan) {
      try {
        this.logger.info('Running device discovery', { methods });
        const discovered = await this.networkScanner.discoverDevices(ranges, methods);

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
        const v3 =
          device.snmpVersion === '3'
            ? {
                username: device.snmpUsername || '',
                authProtocol: device.snmpAuthProtocol,
                authKey: device.snmpAuthKey,
                privProtocol: device.snmpPrivProtocol,
                privKey: device.snmpPrivKey,
              }
            : undefined;
        return await this.snmpCollector.collect(device.ipAddress, {
          community: device.snmpCommunity || 'public',
          version: device.snmpVersion || '2c',
          port: device.snmpPort || 161,
          timeout: config.collection.timeout,
          retries: config.collection.retryAttempts,
          v3,
        });
      } else {
        const httpProto = device.protocol === 'https' ? 'https' : 'http';
        return await this.httpCollector.collect(device.ipAddress, {
          protocol: httpProto,
          port: device.httpPort || (httpProto === 'https' ? 443 : 80),
          username: device.username,
          password: device.password,
          timeout: config.collection.timeout,
          rejectUnauthorized: device.httpRejectUnauthorized !== false,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to collect from ${device.ipAddress}`, { error });
      throw error;
    }
  }

  /**
   * Send heartbeat to Printyx and process any commands the server
   * returned. Failures here are non-fatal — collection keeps running.
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const response = await this.apiClient.sendHeartbeat();
      this.logger.debug('Heartbeat sent successfully');
      if (response.pendingCommands && response.pendingCommands.length > 0) {
        // Fire-and-forget; CommandProcessor handles its own errors and acks.
        this.commandProcessor.processBatch(response.pendingCommands).catch((err) => {
          this.logger.error('Command batch processing crashed', { err });
        });
      }
      // Self-update if the platform advertises a newer bundle. This may
      // process.exit(0) to let the service manager restart us — intentional.
      this.updateManager.maybeUpdate(response.update).catch((err) => {
        this.logger.error('Auto-update check crashed', { err });
      });
    } catch (error) {
      this.logger.error('Failed to send heartbeat', { error });
    }
  }

  // ── Command handlers (called by CommandProcessor) ──────────────────

  private async handleForceSubmit(): Promise<{
    devicesCollected: number;
    devicesSubmitted: number;
  }> {
    const before = this.dataBuffer.getStats().totalSubmissions;
    await this.collectAndSubmitMetrics();
    const after = this.dataBuffer.getStats().totalSubmissions;
    // If buffer grew, submission failed; otherwise it succeeded.
    const config = this.configManager.getConfig();
    const deviceCount = (config.devices || []).length;
    return {
      devicesCollected: deviceCount,
      devicesSubmitted: after <= before ? deviceCount : 0,
    };
  }

  private async handleRescan(): Promise<{ discovered: number }> {
    const config = this.configManager.getConfig();
    const methods =
      config.collection.discoveryMethods && config.collection.discoveryMethods.length > 0
        ? config.collection.discoveryMethods
        : ['mdns' as const, 'wsd' as const];
    const ranges = config.collection.networkRanges || [];
    // mDNS / WSD don't need a network range; only short-circuit if the
    // operator explicitly chose CIDR-only with no ranges.
    const onlyCidr = methods.length === 1 && methods[0] === 'cidr';
    if (onlyCidr && ranges.length === 0) {
      return { discovered: 0 };
    }
    const discovered = await this.networkScanner.discoverDevices(ranges, methods);
    const existingIPs = new Set((config.devices || []).map((d) => d.ipAddress));
    const newOnes = discovered.filter((d) => !existingIPs.has(d.ipAddress));
    if (newOnes.length > 0) {
      config.devices = [
        ...(config.devices || []),
        ...newOnes.map((d) => ({
          ipAddress: d.ipAddress,
          protocol: d.protocol,
          snmpCommunity: d.protocol === 'snmp' ? 'public' : undefined,
          snmpVersion: d.protocol === 'snmp' ? ('2c' as const) : undefined,
        })),
      ];
      this.configManager.saveConfig(config);
    }
    return { discovered: newOnes.length };
  }

  /**
   * Re-fetch /config from the platform and apply updates to the running
   * agent without a restart. Currently applied: pollingInterval (re-cron),
   * networkRanges, devices, alert thresholds. Anything else is logged
   * but not applied — those changes still require a service restart.
   */
  private async handleReloadConfig(): Promise<{ changed: string[] }> {
    const remote = await this.apiClient.getConfig();
    const local = this.configManager.getConfig();
    const remoteCfg = (remote as any).configuration || {};
    const changed: string[] = [];

    // pollingInterval — reschedule the collection cron in place.
    if (
      typeof remoteCfg.pollingInterval === 'number' &&
      remoteCfg.pollingInterval !== local.collection.pollingInterval
    ) {
      local.collection.pollingInterval = remoteCfg.pollingInterval;
      const newCron = this.secondsToCron(remoteCfg.pollingInterval);
      if (newCron !== this.currentPollingCron) {
        if (this.collectionTask) this.collectionTask.stop();
        this.collectionTask = cron.schedule(newCron, () => this.collectAndSubmitMetrics());
        this.currentPollingCron = newCron;
      }
      changed.push('pollingInterval');
    }

    // networkRanges
    if (Array.isArray(remoteCfg.networkRanges)) {
      const localRanges = (local.collection.networkRanges || []).join(',');
      const remoteRanges = remoteCfg.networkRanges.join(',');
      if (localRanges !== remoteRanges) {
        local.collection.networkRanges = remoteCfg.networkRanges;
        changed.push('networkRanges');
      }
    }

    // devices: replace wholesale if the platform's list differs by length
    // or by ipAddress set. We DON'T merge — the platform is authoritative
    // when it sends a device list.
    if (Array.isArray(remoteCfg.devices)) {
      const localIps = new Set((local.devices || []).map((d) => d.ipAddress));
      const remoteIps = new Set((remoteCfg.devices as any[]).map((d) => d.ipAddress));
      const sameSet =
        localIps.size === remoteIps.size && [...localIps].every((ip) => remoteIps.has(ip));
      if (!sameSet) {
        local.devices = remoteCfg.devices;
        changed.push('devices');
      }
    }

    // alert thresholds
    if (
      typeof remoteCfg.tonerThreshold === 'number' &&
      remoteCfg.tonerThreshold !== local.alerts?.tonerThreshold
    ) {
      local.alerts = {
        ...(local.alerts || { tonerThreshold: 15, paperThreshold: 20 }),
        tonerThreshold: remoteCfg.tonerThreshold,
      };
      changed.push('alerts.tonerThreshold');
    }
    if (
      typeof remoteCfg.paperThreshold === 'number' &&
      remoteCfg.paperThreshold !== local.alerts?.paperThreshold
    ) {
      local.alerts = {
        ...(local.alerts || { tonerThreshold: 15, paperThreshold: 20 }),
        paperThreshold: remoteCfg.paperThreshold,
      };
      changed.push('alerts.paperThreshold');
    }

    if (changed.length > 0) {
      this.configManager.saveConfig(local);
      this.logger.info('Config updated from platform', { changed });
    } else {
      this.logger.debug('Config check: no changes from platform');
    }
    return { changed };
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
}
