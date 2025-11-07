import { exec } from 'child_process';
import { promisify } from 'util';
import { SNMPCollector } from '../collectors/snmp-collector';
import { HTTPCollector } from '../collectors/http-collector';
import { getLogger } from '../utils/logger';

const execAsync = promisify(exec);

export interface DiscoveredDevice {
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  protocol: 'snmp' | 'http';
  isResponding: boolean;
}

export class NetworkScanner {
  private logger = getLogger();
  private snmpCollector = new SNMPCollector();
  private httpCollector = new HTTPCollector();

  /**
   * Discover printers on network ranges
   */
  async discoverDevices(networkRanges: string[]): Promise<DiscoveredDevice[]> {
    this.logger.info('Starting device discovery', { networkRanges });

    const allDevices: DiscoveredDevice[] = [];

    for (const range of networkRanges) {
      try {
        const devices = await this.scanRange(range);
        allDevices.push(...devices);
      } catch (error) {
        this.logger.error(`Failed to scan range ${range}`, { error });
      }
    }

    this.logger.info(`Discovery complete: found ${allDevices.length} devices`);
    return allDevices;
  }

  /**
   * Scan a network range for devices
   * Supports CIDR notation (e.g., 192.168.1.0/24)
   */
  private async scanRange(range: string): Promise<DiscoveredDevice[]> {
    this.logger.info(`Scanning network range: ${range}`);

    const ipAddresses = this.expandCIDR(range);
    const devices: DiscoveredDevice[] = [];

    // Scan in batches to avoid overwhelming the network
    const batchSize = 10;
    for (let i = 0; i < ipAddresses.length; i += batchSize) {
      const batch = ipAddresses.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((ip) => this.probeDevice(ip)));

      devices.push(...(results.filter((d) => d !== null) as DiscoveredDevice[]));
    }

    this.logger.info(`Found ${devices.length} devices in range ${range}`);
    return devices;
  }

  /**
   * Probe a single IP address to see if it's a printer
   */
  private async probeDevice(ipAddress: string): Promise<DiscoveredDevice | null> {
    this.logger.debug(`Probing ${ipAddress}`);

    // Try SNMP first (most reliable for printers)
    try {
      const snmpWorks = await this.snmpCollector.testConnection(ipAddress);
      if (snmpWorks) {
        this.logger.debug(`${ipAddress} responds to SNMP`);

        // Try to get basic info
        try {
          const metrics = await this.snmpCollector.collect(ipAddress);
          return {
            ipAddress,
            manufacturer: metrics.manufacturer,
            model: metrics.model,
            protocol: 'snmp',
            isResponding: true,
          };
        } catch (error) {
          return {
            ipAddress,
            protocol: 'snmp',
            isResponding: true,
          };
        }
      }
    } catch (error) {
      // SNMP failed, try HTTP
    }

    // Try HTTP/HTTPS
    try {
      const httpWorks = await this.httpCollector.testConnection(ipAddress, {
        protocol: 'http',
        port: 80,
      });
      if (httpWorks) {
        this.logger.debug(`${ipAddress} responds to HTTP`);
        return {
          ipAddress,
          protocol: 'http',
          isResponding: true,
        };
      }

      const httpsWorks = await this.httpCollector.testConnection(ipAddress, {
        protocol: 'https',
        port: 443,
      });
      if (httpsWorks) {
        this.logger.debug(`${ipAddress} responds to HTTPS`);
        return {
          ipAddress,
          protocol: 'http',
          isResponding: true,
        };
      }
    } catch (error) {
      // HTTP failed
    }

    return null;
  }

  /**
   * Expand CIDR notation to list of IP addresses
   */
  private expandCIDR(cidr: string): string[] {
    const [baseIP, subnet] = cidr.split('/');
    const subnetMask = parseInt(subnet || '32');

    if (subnetMask === 32) {
      // Single IP
      return [baseIP];
    }

    if (subnetMask < 16 || subnetMask > 32) {
      this.logger.warn(`Unsupported subnet mask: /${subnetMask}. Using /24 instead.`);
      return this.expandCIDR(`${baseIP}/24`);
    }

    const parts = baseIP.split('.').map((p) => parseInt(p));
    const hostBits = 32 - subnetMask;
    const numHosts = Math.pow(2, hostBits) - 2; // Exclude network and broadcast

    if (numHosts > 254) {
      this.logger.warn(`Large subnet (${numHosts} hosts). Limiting to /24 for performance.`);
      return this.expandCIDR(`${baseIP}/24`);
    }

    const ips: string[] = [];

    if (subnetMask >= 24) {
      // /24 to /32
      const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
      const startHost = subnetMask === 24 ? 1 : parts[3];
      const endHost = subnetMask === 24 ? 254 : parts[3] + numHosts;

      for (let i = startHost; i <= endHost; i++) {
        ips.push(`${base}.${i}`);
      }
    } else if (subnetMask >= 16) {
      // /16 to /23
      const base = `${parts[0]}.${parts[1]}`;
      const startThird = subnetMask === 16 ? 0 : parts[2];
      const endThird = Math.min(startThird + Math.floor(numHosts / 254), 255);

      for (let third = startThird; third <= endThird; third++) {
        for (let fourth = 1; fourth <= 254; fourth++) {
          ips.push(`${base}.${third}.${fourth}`);
          if (ips.length >= numHosts) break;
        }
        if (ips.length >= numHosts) break;
      }
    }

    return ips;
  }

  /**
   * Quick ping check using native ping command
   * (Optional optimization before SNMP/HTTP probing)
   */
  private async pingCheck(ipAddress: string): Promise<boolean> {
    try {
      // Use platform-specific ping command
      const pingCmd =
        process.platform === 'win32'
          ? `ping -n 1 -w 1000 ${ipAddress}`
          : `ping -c 1 -W 1 ${ipAddress}`;

      await execAsync(pingCmd);
      return true;
    } catch (error) {
      return false;
    }
  }
}
