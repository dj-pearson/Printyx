import * as snmp from 'net-snmp';
import {
  ICollector,
  DeviceMetrics,
  TonerLevels,
  PaperLevels,
  MeterReadings,
} from './collector-interface';
import { getLogger } from '../utils/logger';

// Standard Printer MIB OIDs (RFC 3805)
const PRINTER_MIB_OIDS = {
  // Device information
  deviceSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
  deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
  deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
  deviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',

  // Marker supplies (toner, ink)
  markerSupplyType: '1.3.6.1.2.1.43.11.1.1.6.1',
  markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',
  markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
  markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
  markerSupplyColorantValue: '1.3.6.1.2.1.43.12.1.1.4.1',

  // Input trays (paper)
  inputType: '1.3.6.1.2.1.43.8.2.1.2.1',
  inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
  inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',

  // Counter/meter readings
  totalPrinted: '1.3.6.1.2.1.43.10.2.1.4.1.1',

  // System information
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysName: '1.3.6.1.2.1.1.5.0',
};

// Vendor-specific OIDs for common manufacturers
const VENDOR_OIDS = {
  canon: {
    totalCounter: '1.3.6.1.4.1.1602.1.11.1.3.1.4.101',
    bwCounter: '1.3.6.1.4.1.1602.1.11.1.3.1.4.102',
    colorCounter: '1.3.6.1.4.1.1602.1.11.1.3.1.4.103',
  },
  xerox: {
    totalCounter: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1',
    bwCounter: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.33',
    colorCounter: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.34',
  },
  hp: {
    totalCounter: '1.3.6.1.4.1.11.2.3.9.4.2.1.4.1.2.6.0',
    serialNumber: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0',
  },
  ricoh: {
    totalCounter: '1.3.6.1.4.1.367.3.2.1.2.19.5.1.5.1',
    serialNumber: '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
  },
};

export interface SNMPCollectorOptions {
  community?: string;
  version?: snmp.Version;
  port?: number;
  timeout?: number;
  retries?: number;
}

export class SNMPCollector implements ICollector {
  private logger = getLogger();
  private defaultOptions: SNMPCollectorOptions = {
    community: 'public',
    version: snmp.Version2c,
    port: 161,
    timeout: 10000,
    retries: 3,
  };

  /**
   * Test SNMP connection to a device
   */
  async testConnection(ipAddress: string, options?: SNMPCollectorOptions): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };

    return new Promise((resolve) => {
      const session = this.createSession(ipAddress, opts);

      session.get([PRINTER_MIB_OIDS.sysDescr], (error, varbinds) => {
        session.close();

        if (error) {
          this.logger.debug(`SNMP connection test failed for ${ipAddress}`, {
            error: error.message,
          });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Collect metrics from a device via SNMP
   */
  async collect(ipAddress: string, options?: SNMPCollectorOptions): Promise<DeviceMetrics> {
    const opts = { ...this.defaultOptions, ...options };
    this.logger.info(`Collecting metrics from ${ipAddress} via SNMP`);

    try {
      // Get basic device information
      const deviceInfo = await this.getDeviceInfo(ipAddress, opts);

      // Get toner levels
      const tonerLevels = await this.getTonerLevels(ipAddress, opts);

      // Get paper levels
      const paperLevels = await this.getPaperLevels(ipAddress, opts);

      // Get meter readings
      const meters = await this.getMeterReadings(ipAddress, opts, deviceInfo.manufacturer);

      const metrics: DeviceMetrics = {
        serialNumber: deviceInfo.serialNumber || `UNKNOWN-${ipAddress}`,
        ipAddress,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        tonerLevels,
        paperLevels,
        meters,
        deviceStatus: 'online',
        errorCodes: [],
        collectionTimestamp: new Date().toISOString(),
        rawData: {
          deviceInfo,
        },
      };

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
   * Create SNMP session
   */
  private createSession(ipAddress: string, options: SNMPCollectorOptions): snmp.Session {
    return snmp.createSession(ipAddress, options.community, {
      port: options.port,
      retries: options.retries,
      timeout: options.timeout,
      version: options.version,
    });
  }

  /**
   * Get basic device information
   */
  private async getDeviceInfo(
    ipAddress: string,
    options: SNMPCollectorOptions,
  ): Promise<{
    serialNumber?: string;
    manufacturer?: string;
    model?: string;
  }> {
    const session = this.createSession(ipAddress, options);

    return new Promise((resolve, reject) => {
      const oids = [
        PRINTER_MIB_OIDS.deviceSerialNumber,
        PRINTER_MIB_OIDS.deviceManufacturer,
        PRINTER_MIB_OIDS.deviceModel,
        PRINTER_MIB_OIDS.sysDescr,
      ];

      session.get(oids, (error, varbinds) => {
        session.close();

        if (error) {
          this.logger.warn(`Failed to get device info from ${ipAddress}`, { error: error.message });
          // Try to get at least system description
          const fallbackSession = this.createSession(ipAddress, options);
          fallbackSession.get([PRINTER_MIB_OIDS.sysDescr], (err, vbs) => {
            fallbackSession.close();
            if (!err && vbs && vbs.length > 0) {
              const sysDescr = vbs[0].value.toString();
              const manufacturer = this.detectManufacturerFromSysDescr(sysDescr);
              resolve({ manufacturer });
            } else {
              resolve({});
            }
          });
          return;
        }

        const info: any = {};

        if (varbinds[0] && !snmp.isVarbindError(varbinds[0])) {
          info.serialNumber = varbinds[0].value.toString();
        }
        if (varbinds[1] && !snmp.isVarbindError(varbinds[1])) {
          info.manufacturer = varbinds[1].value.toString();
        }
        if (varbinds[2] && !snmp.isVarbindError(varbinds[2])) {
          info.model = varbinds[2].value.toString();
        }
        if (varbinds[3] && !snmp.isVarbindError(varbinds[3])) {
          const sysDescr = varbinds[3].value.toString();
          if (!info.manufacturer) {
            info.manufacturer = this.detectManufacturerFromSysDescr(sysDescr);
          }
        }

        resolve(info);
      });
    });
  }

  /**
   * Get toner levels
   */
  private async getTonerLevels(
    ipAddress: string,
    options: SNMPCollectorOptions,
  ): Promise<TonerLevels> {
    const session = this.createSession(ipAddress, options);

    return new Promise((resolve) => {
      const tonerLevels: TonerLevels = {};

      // Walk the marker supply table
      session.table(
        PRINTER_MIB_OIDS.markerSupplyCurrentLevel,
        [PRINTER_MIB_OIDS.markerSupplyMaxCapacity, PRINTER_MIB_OIDS.markerSupplyDescription],
        (error, table) => {
          session.close();

          if (error) {
            this.logger.warn(`Failed to get toner levels from ${ipAddress}`, {
              error: error.message,
            });
            resolve({});
            return;
          }

          for (const index in table) {
            const row = table[index];
            const currentLevel = row[PRINTER_MIB_OIDS.markerSupplyCurrentLevel];
            const maxCapacity = row[PRINTER_MIB_OIDS.markerSupplyMaxCapacity];
            const description = row[PRINTER_MIB_OIDS.markerSupplyDescription];

            if (currentLevel && maxCapacity && maxCapacity > 0) {
              const percentage = Math.round((currentLevel / maxCapacity) * 100);
              const color = this.detectColorFromDescription(description?.toString() || '');

              if (color) {
                tonerLevels[color] = percentage;
              }
            }
          }

          resolve(tonerLevels);
        },
      );
    });
  }

  /**
   * Get paper levels
   */
  private async getPaperLevels(
    ipAddress: string,
    options: SNMPCollectorOptions,
  ): Promise<PaperLevels> {
    const session = this.createSession(ipAddress, options);

    return new Promise((resolve) => {
      const paperLevels: PaperLevels = {};

      session.table(
        PRINTER_MIB_OIDS.inputCurrentLevel,
        [PRINTER_MIB_OIDS.inputMaxCapacity],
        (error, table) => {
          session.close();

          if (error) {
            this.logger.warn(`Failed to get paper levels from ${ipAddress}`, {
              error: error.message,
            });
            resolve({});
            return;
          }

          let trayIndex = 1;
          for (const index in table) {
            const row = table[index];
            const currentLevel = row[PRINTER_MIB_OIDS.inputCurrentLevel];
            const maxCapacity = row[PRINTER_MIB_OIDS.inputMaxCapacity];

            if (currentLevel && maxCapacity && maxCapacity > 0) {
              const percentage = Math.round((currentLevel / maxCapacity) * 100);
              paperLevels[`tray${trayIndex}`] = percentage;
              trayIndex++;
            }
          }

          resolve(paperLevels);
        },
      );
    });
  }

  /**
   * Get meter readings
   */
  private async getMeterReadings(
    ipAddress: string,
    options: SNMPCollectorOptions,
    manufacturer?: string,
  ): Promise<MeterReadings> {
    const session = this.createSession(ipAddress, options);

    return new Promise((resolve) => {
      const meters: MeterReadings = {};

      // Try manufacturer-specific OIDs first
      let oids = [PRINTER_MIB_OIDS.totalPrinted];

      if (manufacturer) {
        const vendor = manufacturer.toLowerCase();
        if (vendor.includes('canon') && VENDOR_OIDS.canon) {
          oids = [
            VENDOR_OIDS.canon.totalCounter,
            VENDOR_OIDS.canon.bwCounter,
            VENDOR_OIDS.canon.colorCounter,
          ];
        } else if (vendor.includes('xerox') && VENDOR_OIDS.xerox) {
          oids = [
            VENDOR_OIDS.xerox.totalCounter,
            VENDOR_OIDS.xerox.bwCounter,
            VENDOR_OIDS.xerox.colorCounter,
          ];
        } else if (vendor.includes('hp') && VENDOR_OIDS.hp) {
          oids = [VENDOR_OIDS.hp.totalCounter];
        }
      }

      session.get(oids, (error, varbinds) => {
        session.close();

        if (error) {
          this.logger.warn(`Failed to get meter readings from ${ipAddress}`, {
            error: error.message,
          });
          resolve({});
          return;
        }

        if (varbinds[0] && !snmp.isVarbindError(varbinds[0])) {
          meters.totalImpressions = parseInt(varbinds[0].value.toString());
        }
        if (varbinds[1] && !snmp.isVarbindError(varbinds[1])) {
          meters.bwImpressions = parseInt(varbinds[1].value.toString());
        }
        if (varbinds[2] && !snmp.isVarbindError(varbinds[2])) {
          meters.colorImpressions = parseInt(varbinds[2].value.toString());
        }

        resolve(meters);
      });
    });
  }

  /**
   * Detect color from supply description
   */
  private detectColorFromDescription(description: string): string | null {
    const lower = description.toLowerCase();

    if (lower.includes('black') || lower.includes('bk')) return 'black';
    if (lower.includes('cyan') || lower.includes('cy')) return 'cyan';
    if (lower.includes('magenta') || lower.includes('mg')) return 'magenta';
    if (lower.includes('yellow') || lower.includes('yl')) return 'yellow';

    return null;
  }

  /**
   * Detect manufacturer from system description
   */
  private detectManufacturerFromSysDescr(sysDescr: string): string | undefined {
    const lower = sysDescr.toLowerCase();

    if (lower.includes('canon')) return 'Canon';
    if (lower.includes('xerox')) return 'Xerox';
    if (lower.includes('hp') || lower.includes('hewlett')) return 'HP';
    if (lower.includes('ricoh')) return 'Ricoh';
    if (lower.includes('konica')) return 'Konica Minolta';
    if (lower.includes('lexmark')) return 'Lexmark';
    if (lower.includes('brother')) return 'Brother';
    if (lower.includes('epson')) return 'Epson';

    return undefined;
  }
}
