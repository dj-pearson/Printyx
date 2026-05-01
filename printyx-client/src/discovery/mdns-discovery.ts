// mDNS / Bonjour / DNS-SD discovery for printers.
//
// Most modern printers (HP, Brother, Canon, Xerox, Konica, Ricoh,
// Kyocera) advertise themselves on the local subnet via mDNS. We
// listen for the printer-related service types and translate the
// responses into our DiscoveredDevice shape.
//
// This is intra-LAN only — multicast packets do not traverse routers,
// so we never see (or talk to) anything outside the subnet the agent
// is running on.
//
// Service types we care about:
//   _ipp._tcp           — Internet Printing Protocol (port 631)
//   _ipps._tcp          — IPP over TLS
//   _printer._tcp       — generic printer service
//   _pdl-datastream._tcp — raw print port 9100
//   _uscan._tcp         — eSCL scanners (often the same MFP)

import type { DiscoveredDevice } from './network-scanner';
import { getLogger } from '../utils/logger';

// `bonjour-service` ships its own .d.ts. Use `any` if running before
// dependency install — `bonjour-service` is in package.json but the
// install hasn't happened yet at type-check time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Bonjour } from 'bonjour-service';

export interface MdnsDiscoveryOptions {
  /** Wait this many milliseconds for responses (default 5000). */
  timeoutMs?: number;
  /** Service types to query. Defaults cover all major printer protocols. */
  serviceTypes?: string[];
}

const DEFAULT_SERVICE_TYPES = ['ipp', 'ipps', 'printer', 'pdl-datastream', 'uscan'];

export class MdnsDiscovery {
  private logger = getLogger();

  /**
   * Browse for printers on the local subnet. Resolves with the
   * de-duplicated list of devices found within `timeoutMs`.
   */
  async discover(options?: MdnsDiscoveryOptions): Promise<DiscoveredDevice[]> {
    const timeoutMs = options?.timeoutMs ?? 5000;
    const serviceTypes = options?.serviceTypes ?? DEFAULT_SERVICE_TYPES;

    const bonjour = new Bonjour();
    const seen = new Map<string, DiscoveredDevice>();

    const browsers: any[] = [];

    return new Promise<DiscoveredDevice[]>((resolve) => {
      const finish = () => {
        for (const b of browsers) {
          try {
            b.stop();
          } catch {
            /* swallow */
          }
        }
        try {
          bonjour.destroy();
        } catch {
          /* swallow */
        }
        resolve([...seen.values()]);
      };

      for (const type of serviceTypes) {
        const browser = bonjour.find({ type }, (service: any) => {
          const ip = pickIPv4(service.addresses);
          if (!ip) return; // no usable IPv4 address — skip

          const existing = seen.get(ip);
          const txt = (service.txt || {}) as Record<string, string>;

          // Manufacturer / model often live in the TXT record under
          // `usb_MFG`, `ty`, or `product`. Bonjour gives us decoded
          // strings already.
          const manufacturer =
            txt.usb_MFG || txt.usb_mfg || txt.MFG || txt.mfg || existing?.manufacturer;
          const model = txt.ty || txt.product || txt.usb_MDL || existing?.model;

          // Choose the most specific protocol we've seen for this device.
          // SNMP isn't an mDNS service so we always default to 'snmp' —
          // the SNMP collector is still the right read path; mDNS just
          // tells us the IP.
          const merged: DiscoveredDevice = {
            ipAddress: ip,
            hostname: service.host || existing?.hostname,
            manufacturer,
            model,
            protocol: 'snmp',
            isResponding: true,
          };
          seen.set(ip, merged);
          this.logger.debug(`mDNS: ${type} discovered ${ip}`, {
            host: service.host,
            name: service.name,
            mfg: manufacturer,
            model,
          });
        });
        browsers.push(browser);
      }

      setTimeout(finish, timeoutMs);
    });
  }
}

/** Pick the first non-link-local IPv4 address from a Bonjour `addresses` list. */
function pickIPv4(addresses: string[] | undefined): string | undefined {
  if (!addresses) return undefined;
  for (const a of addresses) {
    if (!a.includes('.')) continue; // skip IPv6
    if (a.startsWith('169.254.')) continue; // skip link-local
    return a;
  }
  return undefined;
}
