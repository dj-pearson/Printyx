// HTTP collector — used when SNMP is locked down or disabled on a
// device. It tries (in order):
//   1. A vendor-specific scraper (vendor-scrapers.ts), keyed off a
//      lightweight identification probe.
//   2. A generic probe that returns whatever it can parse.
//
// HTTPS is preferred over HTTP. The agent rejects self-signed certs by
// default — set `rejectUnauthorized: false` per device when you really
// need to talk to a printer's self-signed admin UI on the LAN.

import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { ICollector, DeviceMetrics } from './collector-interface';
import { detectVendor, type Vendor } from './vendor-oids';
import { VENDOR_SCRAPERS, scrapeHp, scrapeKonicaMinolta } from './vendor-scrapers';
import { getLogger } from '../utils/logger';

export interface HTTPCollectorOptions {
  protocol?: 'http' | 'https';
  port?: number;
  username?: string;
  password?: string;
  timeout?: number;
  /** Some devices have a self-signed admin UI cert; defaults to true. */
  rejectUnauthorized?: boolean;
}

export class HTTPCollector implements ICollector {
  private logger = getLogger();
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      validateStatus: () => true, // we look at status ourselves
      // Default to strict TLS. Per-call overrides go through buildClient().
      httpsAgent: new https.Agent({ rejectUnauthorized: true }),
    });
  }

  /**
   * A test connection just probes the root and sees if anything answers.
   * 200 or 401 both count — 401 means there's a printer there, it just
   * needs auth. Anything else means try a different protocol/port.
   */
  async testConnection(ipAddress: string, options?: HTTPCollectorOptions): Promise<boolean> {
    const opts = this.getDefaultOptions(options);
    const url = this.baseUrl(ipAddress, opts);
    try {
      const client = this.buildClient(opts);
      const response = await client.get(url, {
        timeout: opts.timeout,
        auth: this.buildAuth(opts),
      });
      return response.status === 200 || response.status === 401;
    } catch (error) {
      this.logger.debug(`HTTP connection test failed for ${ipAddress}`, {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  async collect(ipAddress: string, options?: HTTPCollectorOptions): Promise<DeviceMetrics> {
    const opts = this.getDefaultOptions(options);
    const client = this.buildClient(opts);
    this.logger.info(`Collecting metrics from ${ipAddress} via HTTP (${opts.protocol})`);

    try {
      const vendor = await this.detectVendorOverHttp(client, ipAddress, opts);
      const scraper = VENDOR_SCRAPERS[vendor];

      let metrics: Partial<DeviceMetrics> | null = null;
      if (scraper) {
        try {
          metrics = await scraper(client, ipAddress, opts);
        } catch (err) {
          this.logger.warn(`Vendor scraper for '${vendor}' threw — falling back`, { err });
        }
      }

      // If the vendor scraper didn't find anything (or wasn't available),
      // try HP and KM in turn — those are the most common formats on
      // SNMP-locked-down enterprise hardware. Cheap to try; bails fast on 404.
      if (!metrics || !this.isMetricsUseful(metrics)) {
        for (const fallback of [scrapeHp, scrapeKonicaMinolta]) {
          if (fallback === scraper) continue;
          const candidate = await fallback(client, ipAddress, opts).catch(() => null);
          if (candidate && this.isMetricsUseful(candidate)) {
            metrics = candidate;
            break;
          }
        }
      }

      if (metrics && this.isMetricsUseful(metrics)) {
        return this.fillDefaults(metrics, ipAddress);
      }

      // Nothing produced useful data. Return a minimal record so the
      // device still shows up in the dashboard, with a clear note.
      this.logger.warn(
        `HTTP collection returned no usable data for ${ipAddress} (vendor=${vendor})`,
      );
      return {
        serialNumber: `HTTP-${ipAddress}`,
        ipAddress,
        manufacturer: vendor === 'unknown' ? undefined : vendor,
        deviceStatus: 'unknown',
        errorCodes: ['HTTP collector did not find a supported scrape path'],
        collectionTimestamp: new Date().toISOString(),
        rawData: { via: 'http', vendor },
      };
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

  // ── Vendor detection over HTTP ───────────────────────────────────

  /**
   * Identify the vendor by probing the root page and checking the
   * Server header + body for known markers. Cheap (one GET) and uses
   * the same `detectVendor()` heuristic as the SNMP path.
   */
  private async detectVendorOverHttp(
    http: AxiosInstance,
    ipAddress: string,
    options: HTTPCollectorOptions,
  ): Promise<Vendor> {
    const url = this.baseUrl(ipAddress, options);
    try {
      const resp = await http.get(url, {
        timeout: options.timeout,
        auth: this.buildAuth(options),
        responseType: 'text',
        transformResponse: [(d) => d],
      });
      const server = String(resp.headers['server'] || '');
      const body = typeof resp.data === 'string' ? resp.data.slice(0, 4096) : '';
      // Build a faux sysDescr for the existing heuristic.
      const fauxSysDescr = `${server} ${body.replace(/<[^>]*>/g, ' ')}`;
      return detectVendor(undefined, fauxSysDescr);
    } catch {
      return 'unknown';
    }
  }

  private buildClient(options: HTTPCollectorOptions): AxiosInstance {
    return axios.create({
      timeout: options.timeout || 10000,
      validateStatus: () => true,
      httpsAgent: new https.Agent({
        rejectUnauthorized: options.rejectUnauthorized !== false,
      }),
    });
  }

  private buildAuth(options: HTTPCollectorOptions) {
    if (!options.username) return undefined;
    return { username: options.username, password: options.password || '' };
  }

  private baseUrl(ipAddress: string, options: HTTPCollectorOptions): string {
    const port = options.port;
    const proto = options.protocol;
    const defaultPort = proto === 'https' ? 443 : 80;
    return `${proto}://${ipAddress}${port === defaultPort ? '' : `:${port}`}`;
  }

  /** A scrape result is "useful" if it has at least one toner level OR a meter reading. */
  private isMetricsUseful(m: Partial<DeviceMetrics>): boolean {
    const hasToner =
      m.tonerLevels && Object.values(m.tonerLevels).some((v) => typeof v === 'number');
    const hasMeter =
      m.meters &&
      ((typeof m.meters.totalImpressions === 'number' && m.meters.totalImpressions > 0) ||
        (typeof m.meters.bwImpressions === 'number' && m.meters.bwImpressions > 0) ||
        (typeof m.meters.colorImpressions === 'number' && m.meters.colorImpressions > 0));
    const hasSerial =
      m.serialNumber && !m.serialNumber.startsWith('HP-') && !m.serialNumber.startsWith('KM-');
    return Boolean(hasToner || hasMeter || hasSerial);
  }

  private fillDefaults(m: Partial<DeviceMetrics>, ipAddress: string): DeviceMetrics {
    return {
      serialNumber: m.serialNumber || `HTTP-${ipAddress}`,
      ipAddress: m.ipAddress || ipAddress,
      manufacturer: m.manufacturer,
      model: m.model,
      tonerLevels: m.tonerLevels || {},
      paperLevels: m.paperLevels || {},
      meters: m.meters || {},
      deviceStatus: m.deviceStatus || 'online',
      errorCodes: m.errorCodes || [],
      collectionTimestamp: m.collectionTimestamp || new Date().toISOString(),
      rawData: m.rawData,
    };
  }

  private getDefaultOptions(options?: HTTPCollectorOptions): Required<HTTPCollectorOptions> {
    // Default to HTTPS — most modern enterprise printers redirect HTTP
    // to HTTPS anyway, and operators tend to lock the embedded web
    // server behind TLS.
    return {
      protocol: options?.protocol || 'https',
      port: options?.port || (options?.protocol === 'http' ? 80 : 443),
      username: options?.username || '',
      password: options?.password || '',
      timeout: options?.timeout || 10000,
      rejectUnauthorized: options?.rejectUnauthorized !== false,
    };
  }
}
