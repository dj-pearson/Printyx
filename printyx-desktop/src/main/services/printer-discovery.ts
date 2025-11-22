import { EventEmitter } from 'events';
import snmp from 'net-snmp';
import log from 'electron-log';

interface PrinterDevice {
  ip: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  contact?: string;
  name?: string;
  status?: string;
}

export class PrinterDiscovery extends EventEmitter {
  private readonly PRINTER_OIDS = {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
    sysContact: '1.3.6.1.2.1.1.4.0',
    hrDeviceDescr: '1.3.6.1.2.1.25.3.2.1.3.1',
    prtGeneralSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
    prtMarkerSuppliesDescription: '1.3.6.1.2.1.43.11.1.1.6',
  };

  private discoveryInProgress = false;

  constructor() {
    super();
  }

  async discoverPrinters(subnet?: string): Promise<PrinterDevice[]> {
    if (this.discoveryInProgress) {
      throw new Error('Discovery already in progress');
    }

    this.discoveryInProgress = true;
    const discoveredPrinters: PrinterDevice[] = [];

    try {
      const networkSubnet = subnet || (await this.getLocalSubnet());
      log.info(`Starting printer discovery on subnet: ${networkSubnet}`);

      const promises: Promise<void>[] = [];

      // Scan the subnet (e.g., 192.168.1.0/24 -> 192.168.1.1-254)
      const baseIP = networkSubnet.split('.').slice(0, 3).join('.');

      for (let i = 1; i <= 254; i++) {
        const ip = `${baseIP}.${i}`;

        promises.push(
          this.probePrinter(ip)
            .then((device) => {
              if (device) {
                discoveredPrinters.push(device);
                this.emit('device-found', device);
                log.info(`Found printer: ${device.model} at ${device.ip}`);
              }
            })
            .catch((error) => {
              // Silent fail for unreachable IPs
              log.debug(`Failed to probe ${ip}:`, error.message);
            }),
        );
      }

      await Promise.allSettled(promises);

      log.info(`Discovery complete. Found ${discoveredPrinters.length} printers`);
      return discoveredPrinters;
    } finally {
      this.discoveryInProgress = false;
    }
  }

  private async probePrinter(ip: string): Promise<PrinterDevice | null> {
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, 'public', {
        version: snmp.Version2c,
        timeout: 2000,
        retries: 1,
      });

      const oids = Object.values(this.PRINTER_OIDS);

      session.get(oids, (error, varbinds) => {
        session.close();

        if (error) {
          resolve(null);
          return;
        }

        // Check if this is a printer by looking for printer-specific OIDs
        const hasDescription = varbinds.some(
          (vb) =>
            vb.oid === this.PRINTER_OIDS.sysDescr &&
            vb.value &&
            (vb.value.toString().toLowerCase().includes('printer') ||
              vb.value.toString().toLowerCase().includes('copier') ||
              vb.value.toString().toLowerCase().includes('mfp')),
        );

        if (!hasDescription) {
          resolve(null);
          return;
        }

        const device: PrinterDevice = {
          ip,
        };

        varbinds.forEach((vb) => {
          if (snmp.isVarbindError(vb)) {
            return;
          }

          const value = vb.value?.toString() || '';

          switch (vb.oid) {
            case this.PRINTER_OIDS.sysDescr:
              // Extract manufacturer and model from description
              const descr = value;
              device.manufacturer = this.extractManufacturer(descr);
              device.model = this.extractModel(descr);
              break;
            case this.PRINTER_OIDS.sysName:
              device.hostname = value;
              device.name = value;
              break;
            case this.PRINTER_OIDS.sysLocation:
              device.location = value;
              break;
            case this.PRINTER_OIDS.sysContact:
              device.contact = value;
              break;
            case this.PRINTER_OIDS.prtGeneralSerialNumber:
              device.serialNumber = value;
              break;
            case this.PRINTER_OIDS.hrDeviceDescr:
              if (!device.model) {
                device.model = value;
              }
              break;
          }
        });

        resolve(device);
      });
    });
  }

  private extractManufacturer(description: string): string {
    const manufacturers = [
      'Canon',
      'HP',
      'Hewlett-Packard',
      'Xerox',
      'Ricoh',
      'Kyocera',
      'Brother',
      'Epson',
      'Konica Minolta',
      'Sharp',
      'Lexmark',
      'Dell',
      'Samsung',
      'Toshiba',
      'Oki',
      'Panasonic',
    ];

    for (const manufacturer of manufacturers) {
      if (description.toLowerCase().includes(manufacturer.toLowerCase())) {
        return manufacturer;
      }
    }

    return 'Unknown';
  }

  private extractModel(description: string): string {
    // Try to extract model number from description
    // This is a simplified approach - real implementation would be more sophisticated
    const modelMatch = description.match(/([A-Z0-9]+[-\s][A-Z0-9]+)/i);
    return modelMatch ? modelMatch[1] : description;
  }

  private async getLocalSubnet(): Promise<string> {
    const { networkInterfaces } = await import('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
      const netInterface = nets[name];
      if (!netInterface) continue;

      for (const net of netInterface) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          const ip = net.address;
          const subnet = ip.split('.').slice(0, 3).join('.') + '.0/24';
          return subnet;
        }
      }
    }

    return '192.168.1.0/24'; // Default fallback
  }
}
