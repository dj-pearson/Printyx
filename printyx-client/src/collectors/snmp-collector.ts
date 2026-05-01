import * as snmp from 'net-snmp';
import {
  ICollector,
  DeviceMetrics,
  TonerLevels,
  PaperLevels,
  MeterReadings,
} from './collector-interface';
import {
  PRINTER_MIB,
  SupplyType,
  VENDOR_COUNTERS,
  VendorDisplayName,
  counterOidsFor,
  detectVendor,
  type Vendor,
} from './vendor-oids';
import { getLogger } from '../utils/logger';

export interface SNMPCollectorOptions {
  community?: string;
  version?: '1' | '2c' | '3' | snmp.Version;
  port?: number;
  timeout?: number;
  retries?: number;
  // SNMPv3 (mandatory when version === '3' or snmp.Version3)
  v3?: {
    username: string;
    level?: 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';
    authProtocol?: 'MD5' | 'SHA' | 'SHA224' | 'SHA256' | 'SHA384' | 'SHA512';
    authKey?: string;
    privProtocol?: 'DES' | 'AES';
    privKey?: string;
    context?: string;
  };
}

interface DeviceInfo {
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  vendor: Vendor;
  sysObjectID?: string;
  sysDescr?: string;
}

export class SNMPCollector implements ICollector {
  private logger = getLogger();
  private defaultOptions: SNMPCollectorOptions = {
    community: 'public',
    version: '2c',
    port: 161,
    timeout: 10000,
    retries: 3,
  };

  // ── public surface ─────────────────────────────────────────────────
  async testConnection(ipAddress: string, options?: SNMPCollectorOptions): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    return new Promise((resolve) => {
      const session = this.createSession(ipAddress, opts);
      session.get([PRINTER_MIB.sysDescr], (error: Error | null) => {
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

  async collect(ipAddress: string, options?: SNMPCollectorOptions): Promise<DeviceMetrics> {
    const opts = { ...this.defaultOptions, ...options };
    this.logger.info(`Collecting metrics from ${ipAddress} via SNMP${this.versionLabel(opts)}`);

    try {
      const info = await this.getDeviceInfo(ipAddress, opts);
      const [supplies, paperLevels, meters] = await Promise.all([
        this.getSupplies(ipAddress, opts),
        this.getPaperLevels(ipAddress, opts),
        this.getMeterReadings(ipAddress, opts, info.vendor),
      ]);

      const metrics: DeviceMetrics = {
        serialNumber: info.serialNumber || `UNKNOWN-${ipAddress}`,
        ipAddress,
        manufacturer: info.manufacturer,
        model: info.model,
        tonerLevels: supplies.tonerLevels,
        paperLevels,
        meters,
        deviceStatus: 'online',
        errorCodes: [],
        collectionTimestamp: new Date().toISOString(),
        rawData: {
          vendor: info.vendor,
          sysObjectID: info.sysObjectID,
          sysDescr: info.sysDescr,
          supplies: supplies.detailedSupplies, // full marker-supplies table
        },
      };

      this.logger.info(`Collected metrics from ${ipAddress} (${info.vendor})`);
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

  // ── session creation (v1 / v2c / v3) ───────────────────────────────
  private createSession(ipAddress: string, options: SNMPCollectorOptions): snmp.Session {
    const version = this.normalizedVersion(options.version);
    if (version === snmp.Version3) {
      return this.createV3Session(ipAddress, options);
    }
    return snmp.createSession(ipAddress, options.community || 'public', {
      port: options.port || 161,
      retries: options.retries ?? 3,
      timeout: options.timeout ?? 10000,
      version,
    });
  }

  private createV3Session(ipAddress: string, options: SNMPCollectorOptions): snmp.Session {
    const v3 = options.v3;
    if (!v3 || !v3.username) {
      throw new Error('SNMPv3 selected but options.v3.username was not provided.');
    }

    const level = this.resolveSecurityLevel(v3);
    const user: any = { name: v3.username, level };

    if (level !== snmp.SecurityLevel.noAuthNoPriv) {
      if (!v3.authKey) {
        throw new Error('SNMPv3 authNoPriv/authPriv selected but authKey was not provided.');
      }
      user.authProtocol = this.resolveAuthProtocol(v3.authProtocol);
      user.authKey = v3.authKey;
    }
    if (level === snmp.SecurityLevel.authPriv) {
      if (!v3.privKey) {
        throw new Error('SNMPv3 authPriv selected but privKey was not provided.');
      }
      user.privProtocol = this.resolvePrivProtocol(v3.privProtocol);
      user.privKey = v3.privKey;
    }

    return snmp.createV3Session(ipAddress, user, {
      port: options.port || 161,
      retries: options.retries ?? 3,
      timeout: options.timeout ?? 10000,
      version: snmp.Version3,
      context: v3.context || '',
    });
  }

  private resolveSecurityLevel(v3: NonNullable<SNMPCollectorOptions['v3']>): number {
    if (v3.level === 'noAuthNoPriv') return snmp.SecurityLevel.noAuthNoPriv;
    if (v3.level === 'authNoPriv') return snmp.SecurityLevel.authNoPriv;
    // Default to authPriv when keys are present, otherwise noAuthNoPriv.
    if (v3.authKey && v3.privKey) return snmp.SecurityLevel.authPriv;
    if (v3.authKey) return snmp.SecurityLevel.authNoPriv;
    return snmp.SecurityLevel.noAuthNoPriv;
  }

  private resolveAuthProtocol(value?: string) {
    switch ((value || 'SHA').toUpperCase()) {
      case 'MD5':
        return snmp.AuthProtocols.md5;
      case 'SHA':
        return snmp.AuthProtocols.sha;
      case 'SHA224':
        return (snmp.AuthProtocols as any).sha224 || snmp.AuthProtocols.sha;
      case 'SHA256':
        return (snmp.AuthProtocols as any).sha256 || snmp.AuthProtocols.sha;
      case 'SHA384':
        return (snmp.AuthProtocols as any).sha384 || snmp.AuthProtocols.sha;
      case 'SHA512':
        return (snmp.AuthProtocols as any).sha512 || snmp.AuthProtocols.sha;
      default:
        return snmp.AuthProtocols.sha;
    }
  }

  private resolvePrivProtocol(value?: string) {
    switch ((value || 'AES').toUpperCase()) {
      case 'DES':
        return snmp.PrivProtocols.des;
      case 'AES':
        return snmp.PrivProtocols.aes;
      default:
        return snmp.PrivProtocols.aes;
    }
  }

  private normalizedVersion(value?: string | snmp.Version): snmp.Version {
    if (value === '1' || value === snmp.Version1) return snmp.Version1;
    if (value === '3' || value === snmp.Version3) return snmp.Version3;
    return snmp.Version2c;
  }

  private versionLabel(opts: SNMPCollectorOptions) {
    const v = this.normalizedVersion(opts.version);
    if (v === snmp.Version1) return ' (v1)';
    if (v === snmp.Version3) return ' (v3)';
    return ' (v2c)';
  }

  // ── device info: serial, model, vendor ─────────────────────────────
  private async getDeviceInfo(
    ipAddress: string,
    options: SNMPCollectorOptions,
  ): Promise<DeviceInfo> {
    const session = this.createSession(ipAddress, options);
    return new Promise((resolve) => {
      const oids = [
        PRINTER_MIB.prtGeneralSerialNumber,
        PRINTER_MIB.sysObjectID,
        PRINTER_MIB.sysDescr,
        PRINTER_MIB.sysName,
      ];
      session.get(oids, (error, varbinds) => {
        session.close();
        const info: DeviceInfo = { vendor: 'unknown' };
        if (error) {
          this.logger.warn(`Failed to fetch device info from ${ipAddress}`, {
            error: error.message,
          });
          resolve(info);
          return;
        }
        if (varbinds[0] && !snmp.isVarbindError(varbinds[0])) {
          info.serialNumber = String(varbinds[0].value).trim();
        }
        if (varbinds[1] && !snmp.isVarbindError(varbinds[1])) {
          info.sysObjectID = String(varbinds[1].value);
        }
        if (varbinds[2] && !snmp.isVarbindError(varbinds[2])) {
          info.sysDescr = String(varbinds[2].value);
        }
        info.vendor = detectVendor(info.sysObjectID, info.sysDescr);
        info.manufacturer = VendorDisplayName[info.vendor];
        info.model = this.extractModelFromSysDescr(info.sysDescr, info.vendor);
        resolve(info);
      });
    });
  }

  private extractModelFromSysDescr(sysDescr?: string, vendor?: Vendor): string | undefined {
    if (!sysDescr) return undefined;
    // Heuristic: strip the manufacturer name from sysDescr; the remainder
    // usually starts with the model. Manufacturer-specific cleaners can
    // be added when patterns matter.
    let s = sysDescr;
    if (vendor && vendor !== 'unknown') {
      const name = VendorDisplayName[vendor];
      s = s.replace(new RegExp(name, 'i'), '').trim();
    }
    // sysDescr lines often include "Hardware Address ..." or firmware noise.
    // Take the leading model token group.
    const match = s.match(/^[\s,;\-]*([\w-]+(?:\s+[\w/-]+){0,4})/);
    return match ? match[1].trim() : undefined;
  }

  // ── supplies (toner / drum / fuser / waste) ────────────────────────
  private async getSupplies(
    ipAddress: string,
    options: SNMPCollectorOptions,
  ): Promise<{
    tonerLevels: TonerLevels;
    detailedSupplies: SupplyEntry[];
  }> {
    const session = this.createSession(ipAddress, options);
    return new Promise((resolve) => {
      session.table(PRINTER_MIB.prtMarkerSuppliesEntry, (error, table) => {
        session.close();
        if (error) {
          this.logger.warn(`Supply table fetch failed for ${ipAddress}`, {
            error: error.message,
          });
          resolve({ tonerLevels: {}, detailedSupplies: [] });
          return;
        }

        const tonerLevels: TonerLevels = {};
        const detailedSupplies: SupplyEntry[] = [];

        for (const index in table) {
          const row = table[index] as Record<string, any>;
          // The `table()` helper returns rows keyed by the column number
          // *within* the entry OID. Column numbers come from RFC 3805.
          const supplyClass = Number(row['4']); // prtMarkerSuppliesClass
          const supplyType = Number(row['5']); // prtMarkerSuppliesType
          const description = String(row['6'] ?? '').trim(); // prtMarkerSuppliesDescription
          const maxCapacity = Number(row['8']); // prtMarkerSuppliesMaxCapacity
          const level = Number(row['9']); // prtMarkerSuppliesLevel

          // Per RFC 3805, level -2 = unknown, -3 = remaining, but in practice
          // -2 means "supply is present but level can't be measured".
          const percentage =
            maxCapacity > 0 && level >= 0 ? Math.round((level / maxCapacity) * 100) : undefined;

          const entry: SupplyEntry = {
            index: parseInt(index, 10),
            description,
            type: SupplyType[supplyType] || `unknown(${supplyType})`,
            class: supplyClass === 4 ? 'receptacle' : 'consumable',
            level,
            maxCapacity,
            percentage,
          };
          detailedSupplies.push(entry);

          // Map the standard CMYK to the toner-levels surface so existing
          // dashboards keep working.
          if (supplyType === 3 || supplyType === 21 || supplyType === 5) {
            const colour = this.detectColorFromDescription(description);
            if (colour && percentage !== undefined) {
              tonerLevels[colour] = percentage;
            }
          }
        }

        resolve({ tonerLevels, detailedSupplies });
      });
    });
  }

  // ── paper trays ────────────────────────────────────────────────────
  private async getPaperLevels(
    ipAddress: string,
    options: SNMPCollectorOptions,
  ): Promise<PaperLevels> {
    const session = this.createSession(ipAddress, options);
    return new Promise((resolve) => {
      session.table(PRINTER_MIB.prtInputCurrentLevel, (error, table) => {
        session.close();
        if (error) {
          this.logger.warn(`Paper table fetch failed for ${ipAddress}`, {
            error: error.message,
          });
          resolve({});
          return;
        }
        const paperLevels: PaperLevels = {};
        let trayIndex = 1;
        for (const idx in table) {
          const row = table[idx] as Record<string, any>;
          const current = Number(row['10'] ?? row['1']);
          const max = Number(row['9'] ?? row['2']);
          if (max > 0 && current >= 0) {
            paperLevels[`tray${trayIndex}`] = Math.round((current / max) * 100);
          }
          trayIndex++;
        }
        resolve(paperLevels);
      });
    });
  }

  // ── meter readings ─────────────────────────────────────────────────
  private async getMeterReadings(
    ipAddress: string,
    options: SNMPCollectorOptions,
    vendor: Vendor,
  ): Promise<MeterReadings> {
    const meters: MeterReadings = {};
    const counters = counterOidsFor(vendor);

    // (1) Try vendor-specific scalar counters first.
    if (counters.total || counters.bw || counters.color || counters.large) {
      const oids = [counters.total, counters.bw, counters.color, counters.large].filter(
        (o): o is string => Boolean(o),
      );

      const values = await this.snmpGet(ipAddress, options, oids).catch(() => null);
      if (values) {
        let i = 0;
        if (counters.total) meters.totalImpressions = values[i++];
        if (counters.bw) meters.bwImpressions = values[i++];
        if (counters.color) meters.colorImpressions = values[i++];
        if (counters.large) meters.largeImpressions = values[i++];
      }
    }

    // (2) Fallback: walk prtMarkerLifeCount. Many devices populate this
    //     with one entry for total, or split (mono / colour engines).
    if (meters.totalImpressions === undefined) {
      const walked = await this.walkLifeCount(ipAddress, options).catch(() => null);
      if (walked) {
        if (walked.length === 1) {
          meters.totalImpressions = walked[0];
        } else if (walked.length >= 2) {
          // Convention varies; sum is the safest "total" interpretation.
          meters.totalImpressions = walked.reduce((a, b) => a + b, 0);
          // Heuristic: lower index is often the colour engine, higher is mono.
          // Don't surface BW/colour from the walk — too unreliable cross-vendor.
        }
      }
    }

    return meters;
  }

  private async walkLifeCount(ipAddress: string, options: SNMPCollectorOptions): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession(ipAddress, options);
      const values: number[] = [];
      session.subtree(
        PRINTER_MIB.prtMarkerLifeCount,
        20,
        (varbinds: any[]) => {
          for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) {
              const n = Number(vb.value);
              if (Number.isFinite(n)) values.push(n);
            }
          }
        },
        (error: Error | null) => {
          session.close();
          if (error) reject(error);
          else resolve(values);
        },
      );
    });
  }

  private snmpGet(
    ipAddress: string,
    options: SNMPCollectorOptions,
    oids: string[],
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession(ipAddress, options);
      session.get(oids, (error: Error | null, varbinds: any[]) => {
        session.close();
        if (error) return reject(error);
        const out: number[] = [];
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) {
            out.push(NaN);
          } else {
            const n = Number(vb.value);
            out.push(Number.isFinite(n) ? n : NaN);
          }
        }
        resolve(out);
      });
    });
  }

  private detectColorFromDescription(description: string): string | null {
    const lower = description.toLowerCase();
    if (lower.includes('black') || /\bbk\b|\bk\b/.test(lower)) return 'black';
    if (lower.includes('cyan') || /\bcy?\b/.test(lower)) return 'cyan';
    if (lower.includes('magenta') || /\bmg?\b/.test(lower)) return 'magenta';
    if (lower.includes('yellow') || /\byl?\b/.test(lower)) return 'yellow';
    return null;
  }
}

export interface SupplyEntry {
  index: number;
  description: string;
  type: string; // toner | wasteToner | drum | fuser | …
  class: 'consumable' | 'receptacle';
  level: number; // raw value (-2 = unknown, -3 = remaining count)
  maxCapacity: number;
  percentage?: number;
}
