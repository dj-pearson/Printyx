import { EventEmitter } from 'events';
import snmp from 'net-snmp';
import log from 'electron-log';
import { ApiClient } from './api-client';

interface MonitoringConfig {
  apiKey: string;
  serverUrl: string;
  companyId: string;
  locationId: string;
  printers: PrinterConfig[];
  interval?: number; // minutes
}

interface PrinterConfig {
  id?: string;
  ip: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  location?: string;
  oids: OidConfig[];
  snmpCommunity?: string;
  snmpVersion?: 'v1' | 'v2c' | 'v3';
}

interface OidConfig {
  name: string;
  oid: string;
  description: string;
  category: string;
}

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private apiClient: ApiClient;
  private intervalId?: NodeJS.Timeout;
  private running = false;

  constructor(config: MonitoringConfig) {
    super();
    this.config = {
      ...config,
      interval: config.interval || 15, // Default 15 minutes
    };
    this.apiClient = new ApiClient(config.serverUrl, config.apiKey);
  }

  async start(): Promise<void> {
    if (this.running) {
      log.warn('Monitoring service is already running');
      return;
    }

    log.info('Starting monitoring service');
    this.running = true;

    // Register devices if not already registered
    await this.registerDevices();

    // Collect data immediately
    await this.collectData();

    // Schedule periodic collection
    const intervalMs = this.config.interval! * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.collectData().catch((error) => {
        log.error('Error in scheduled data collection:', error);
        this.emit('error', error);
      });
    }, intervalMs);

    log.info(`Monitoring service started with ${this.config.interval} minute interval`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    log.info('Stopping monitoring service');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.running = false;
    log.info('Monitoring service stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async registerDevices(): Promise<void> {
    log.info('Registering devices with server');

    for (const printer of this.config.printers) {
      if (printer.id) {
        continue; // Already registered
      }

      try {
        const response = await this.apiClient.registerDevice({
          ip: printer.ip,
          manufacturer: printer.manufacturer,
          model: printer.model,
          serialNumber: printer.serialNumber,
          location: printer.location,
          companyId: this.config.companyId,
          locationId: this.config.locationId,
        });

        printer.id = response.deviceId;
        log.info(`Device registered: ${printer.model} (${response.deviceId})`);
      } catch (error) {
        log.error(`Failed to register device ${printer.ip}:`, error);
      }
    }
  }

  private async collectData(): Promise<void> {
    log.info('Collecting monitoring data from all printers');

    const promises = this.config.printers.map((printer) => this.collectPrinterData(printer));

    const results = await Promise.allSettled(promises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const errorCount = results.filter((r) => r.status === 'rejected').length;

    log.info(`Data collection complete: ${successCount} successful, ${errorCount} failed`);

    this.emit('data-collected', {
      timestamp: new Date().toISOString(),
      successCount,
      errorCount,
    });
  }

  private async collectPrinterData(printer: PrinterConfig): Promise<void> {
    if (!printer.id) {
      log.warn(`Skipping printer ${printer.ip}: not registered`);
      return;
    }

    try {
      const metrics = await this.snmpGet(printer);

      await this.apiClient.sendMonitoringData({
        deviceId: printer.id,
        timestamp: new Date().toISOString(),
        metrics,
      });

      log.debug(`Data collected for ${printer.model} (${printer.ip})`);
    } catch (error) {
      log.error(`Failed to collect data from ${printer.ip}:`, error);
      throw error;
    }
  }

  private async snmpGet(
    printer: PrinterConfig,
  ): Promise<{ name: string; value: any; oid: string }[]> {
    return new Promise((resolve, reject) => {
      const community = printer.snmpCommunity || 'public';
      const version =
        printer.snmpVersion === 'v1'
          ? snmp.Version1
          : printer.snmpVersion === 'v3'
            ? snmp.Version3
            : snmp.Version2c;

      const session = snmp.createSession(printer.ip, community, {
        version,
        timeout: 5000,
        retries: 2,
      });

      const oids = printer.oids.map((o) => o.oid);

      session.get(oids, (error, varbinds) => {
        session.close();

        if (error) {
          reject(error);
          return;
        }

        const metrics = varbinds
          .map((vb, index) => {
            if (snmp.isVarbindError(vb)) {
              log.warn(`OID error for ${printer.oids[index].name}: ${snmp.varbindError(vb)}`);
              return null;
            }

            return {
              name: printer.oids[index].name,
              value: this.parseValue(vb.value),
              oid: printer.oids[index].oid,
            };
          })
          .filter((m) => m !== null) as { name: string; value: any; oid: string }[];

        resolve(metrics);
      });
    });
  }

  private parseValue(value: any): any {
    if (Buffer.isBuffer(value)) {
      return value.toString('utf8');
    }
    if (typeof value === 'object' && value !== null) {
      return value.toString();
    }
    return value;
  }
}
