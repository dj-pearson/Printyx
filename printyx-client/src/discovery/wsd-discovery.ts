// WS-Discovery (WSD) for printers.
//
// Windows printers — especially anything that ships with WSD drivers,
// which is most modern HP / Canon / Xerox / Brother / Kyocera MFPs in
// office environments — respond to a SOAP/UDP multicast probe on
// 239.255.255.250:3702. We send one Probe message, listen for
// ProbeMatches responses for `timeoutMs`, and extract `XAddrs`
// (transport addresses, usually http URLs whose hostname is the
// printer's IP).
//
// Local-subnet only by design (UDP multicast doesn't route).
//
// Reference:
//   - WS-Discovery Spec: https://docs.oasis-open.org/ws-dd/ns/discovery/2009/01
//   - Microsoft printer profile: PrinterServiceTypes namespace below.

import * as dgram from 'dgram';
import { randomUUID } from 'crypto';
import type { DiscoveredDevice } from './network-scanner';
import { getLogger } from '../utils/logger';

const WSD_GROUP = '239.255.255.250';
const WSD_PORT = 3702;
const PRINTER_TYPES = 'wprt:PrinterServiceType wscn:ScanDeviceType';

export interface WsdDiscoveryOptions {
  timeoutMs?: number;
}

export class WsdDiscovery {
  private logger = getLogger();

  async discover(options?: WsdDiscoveryOptions): Promise<DiscoveredDevice[]> {
    const timeoutMs = options?.timeoutMs ?? 4000;
    const messageId = `urn:uuid:${randomUUID()}`;
    const probe = buildProbeMessage(messageId);

    return new Promise<DiscoveredDevice[]>((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const seen = new Map<string, DiscoveredDevice>();
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        try {
          socket.close();
        } catch {
          /* swallow */
        }
        resolve([...seen.values()]);
      };

      socket.on('error', (err: Error) => {
        this.logger.warn('WSD socket error', { error: err.message });
        finish();
      });

      socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        const text = msg.toString('utf-8');
        // Lightweight checks: must be a ProbeMatches, must mention a
        // printer service type. We don't pull a full XML parser in for
        // this — the namespace declarations are deterministic enough.
        if (!text.includes('ProbeMatches')) return;
        const isPrinter =
          text.includes('PrinterService') ||
          text.includes('PrinterServiceType') ||
          text.includes('ScanDeviceType');
        if (!isPrinter) return;

        const xaddrs = extract(text, /<wsd:XAddrs>([^<]+)<\/wsd:XAddrs>/i);
        const types = extract(text, /<wsd:Types>([^<]+)<\/wsd:Types>/i);

        // Prefer XAddrs as source-of-truth for the device IP, fall back
        // to the responder address from the UDP packet.
        const fromXaddr = pickIpFromXaddrs(xaddrs);
        const ip = fromXaddr || rinfo.address;
        if (!ip) return;

        const existing = seen.get(ip);
        seen.set(ip, {
          ipAddress: ip,
          hostname: existing?.hostname,
          // We don't have manufacturer/model from the probe alone;
          // resolving via the device's <Get> endpoint would require a
          // follow-up SOAP call. Leave them undefined — the SNMP
          // collector fills them in once the device is monitored.
          manufacturer: existing?.manufacturer,
          model: existing?.model,
          protocol: 'snmp',
          isResponding: true,
        });

        this.logger.debug(`WSD: response from ${ip}`, { types, xaddrs });
      });

      socket.bind(0, () => {
        try {
          socket.setBroadcast(true);
          socket.setMulticastTTL(1); // local subnet only
        } catch (err) {
          this.logger.warn('WSD socket setup error', { err });
        }
        socket.send(probe, 0, probe.length, WSD_PORT, WSD_GROUP, (err) => {
          if (err) {
            this.logger.warn('WSD probe send failed', { error: err.message });
            finish();
          }
        });
      });

      setTimeout(finish, timeoutMs);
    });
  }
}

function buildProbeMessage(messageId: string): Buffer {
  // Minimal WS-Discovery Probe. We declare the namespaces we need for
  // the printer/scanner service types. Receivers that don't recognise
  // these types just ignore the probe.
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
               xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
               xmlns:wprt="http://schemas.microsoft.com/windows/2006/08/wdp/print"
               xmlns:wscn="http://schemas.microsoft.com/windows/2006/08/wdp/scan">
  <soap:Header>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
    <wsa:MessageID>${messageId}</wsa:MessageID>
  </soap:Header>
  <soap:Body>
    <wsd:Probe>
      <wsd:Types>${PRINTER_TYPES}</wsd:Types>
    </wsd:Probe>
  </soap:Body>
</soap:Envelope>`;
  return Buffer.from(xml, 'utf-8');
}

function extract(text: string, regex: RegExp): string | undefined {
  const m = text.match(regex);
  return m?.[1]?.trim();
}

function pickIpFromXaddrs(xaddrs: string | undefined): string | undefined {
  if (!xaddrs) return undefined;
  // XAddrs is a space-separated list of URIs like
  //   "http://192.168.1.50:80/wsd/print"
  for (const xa of xaddrs.split(/\s+/)) {
    try {
      const url = new URL(xa);
      // Only accept literal IPv4 addresses; resolving hostnames here
      // would require a DNS lookup we don't want to do during scan.
      if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return url.hostname;
    } catch {
      /* not a valid URI — skip */
    }
  }
  return undefined;
}
