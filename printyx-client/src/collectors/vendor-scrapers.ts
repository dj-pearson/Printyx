// HTTP/XML scrapers for printers that lock down SNMP.
//
// Each scraper is a pure async function that takes an `axios`-shaped
// HTTP client plus the device IP/options and returns a partial
// DeviceMetrics. Callers (http-collector.ts) decide which scraper to
// use based on the detected manufacturer; the registry below is the
// dispatch table.
//
// We deliberately avoid pulling a full XML parser into printyx-client
// (keeps the install footprint tiny). The vendor XML payloads we care
// about are flat enough that a tag-based regex extractor handles them.
// If a vendor surfaces something genuinely complex later, swap in
// fast-xml-parser at that point.

import type { AxiosInstance } from 'axios';
import type { DeviceMetrics, TonerLevels, MeterReadings } from './collector-interface';
import type { Vendor } from './vendor-oids';

// ── Tiny XML helpers ─────────────────────────────────────────────────
//
// xmlAll('foo', body)  → ['12', '85']  (every <prefix:foo>…</prefix:foo>)
// xmlFirst('foo', body) → first match or undefined
// Strips namespace prefixes so <dd:Foo>1</dd:Foo> matches `'Foo'`.

export function xmlAll(tag: string, body: string): string[] {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9-]+:)?${escapeRe(tag)}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9-]+:)?${escapeRe(tag)}>`,
    'g',
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push(m[1].trim());
  return out;
}

export function xmlFirst(tag: string, body: string): string | undefined {
  return xmlAll(tag, body)[0];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// ── Common HTTP helper ───────────────────────────────────────────────

async function tryGet(
  http: AxiosInstance,
  url: string,
  auth?: { username?: string; password?: string },
): Promise<string | null> {
  try {
    const resp = await http.get(url, {
      auth: auth?.username ? { username: auth.username, password: auth.password || '' } : undefined,
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    if (resp.status >= 200 && resp.status < 300 && typeof resp.data === 'string') {
      return resp.data;
    }
  } catch {
    /* swallow — caller decides what to do when a path 404s */
  }
  return null;
}

// ── HP DevMgmt XML scraper ───────────────────────────────────────────
//
// HP exposes a stable cluster of XML endpoints on most LaserJet /
// PageWide / OfficeJet Pro devices. Known paths:
//   /DevMgmt/ProductConfigDyn.xml   serial, model
//   /DevMgmt/ConsumableConfigDyn.xml supply levels
//   /DevMgmt/PrinterUsageDyn.xml    impression counters
//   /DevMgmt/ProductStatusDyn.xml   device status
//
// All four can be hit anonymously on most fleet-installed HP printers.

export async function scrapeHp(
  http: AxiosInstance,
  ipAddress: string,
  options: { protocol?: 'http' | 'https'; port?: number; username?: string; password?: string },
): Promise<Partial<DeviceMetrics>> {
  const proto = options.protocol || 'https';
  const port = options.port || (proto === 'https' ? 443 : 80);
  const base = `${proto}://${ipAddress}${port === (proto === 'https' ? 443 : 80) ? '' : ':' + port}`;
  const auth = { username: options.username, password: options.password };

  const [productXml, consumableXml, usageXml, statusXml] = await Promise.all([
    tryGet(http, `${base}/DevMgmt/ProductConfigDyn.xml`, auth),
    tryGet(http, `${base}/DevMgmt/ConsumableConfigDyn.xml`, auth),
    tryGet(http, `${base}/DevMgmt/PrinterUsageDyn.xml`, auth),
    tryGet(http, `${base}/DevMgmt/ProductStatusDyn.xml`, auth),
  ]);

  // ── product info ────
  const serialNumber = productXml ? xmlFirst('SerialNumber', productXml) : undefined;
  const model = productXml
    ? xmlFirst('MakeAndModelBase', productXml) || xmlFirst('MakeAndModel', productXml)
    : undefined;

  // ── consumables (toner) ────
  const tonerLevels: TonerLevels = {};
  if (consumableXml) {
    // Each ConsumableInfo has ConsumableLabelCode (K/C/M/Y) and
    // ConsumablePercentageLevelRemaining or ConsumableLifeState.
    const blocks = consumableXml.split(/<\/(?:[a-zA-Z0-9-]+:)?ConsumableInfo>/);
    for (const block of blocks) {
      const code = xmlFirst('ConsumableLabelCode', block);
      const pct = asNumber(xmlFirst('ConsumablePercentageLevelRemaining', block));
      if (code && pct !== undefined) {
        const colour = labelToColour(code);
        if (colour) tonerLevels[colour] = pct;
      }
    }
  }

  // ── meters ────
  const meters: MeterReadings = {};
  if (usageXml) {
    // PrinterUsageDyn has <PrintApplication> with <TotalImpressions>;
    // also <PageCount> entries broken down by mono/colour. The exact
    // node names vary across firmware revisions, so be liberal.
    meters.totalImpressions = asNumber(
      xmlFirst('TotalImpressions', usageXml) ||
        xmlFirst('TotalLifeImpressions', usageXml) ||
        xmlFirst('TotalPagesPrinted', usageXml),
    );
    meters.bwImpressions = asNumber(
      xmlFirst('MonochromeImpressions', usageXml) || xmlFirst('TotalMonoImpressions', usageXml),
    );
    meters.colorImpressions = asNumber(
      xmlFirst('ColorImpressions', usageXml) || xmlFirst('TotalColorImpressions', usageXml),
    );
  }

  // ── status ────
  const deviceStatus: DeviceMetrics['deviceStatus'] = (() => {
    if (!statusXml) return 'online';
    const summary = (xmlFirst('AlertCategoryStatus', statusXml) || '').toLowerCase();
    if (summary.includes('error') || summary.includes('jam')) return 'error';
    if (summary.includes('warning') || summary.includes('low')) return 'maintenance';
    return 'online';
  })();

  return {
    serialNumber: serialNumber ? serialNumber.trim() : `HP-${ipAddress}`,
    ipAddress,
    manufacturer: 'HP',
    model: model?.trim(),
    tonerLevels,
    meters,
    deviceStatus,
    collectionTimestamp: new Date().toISOString(),
    rawData: {
      via: 'http',
      hadProductXml: Boolean(productXml),
      hadConsumableXml: Boolean(consumableXml),
      hadUsageXml: Boolean(usageXml),
      hadStatusXml: Boolean(statusXml),
    },
  };
}

function labelToColour(code: string): string | null {
  switch (code.trim().toUpperCase()) {
    case 'K':
    case 'BK':
    case 'BLACK':
      return 'black';
    case 'C':
    case 'CY':
    case 'CYAN':
      return 'cyan';
    case 'M':
    case 'MG':
    case 'MAGENTA':
      return 'magenta';
    case 'Y':
    case 'YL':
    case 'YELLOW':
      return 'yellow';
    default:
      return null;
  }
}

// ── Konica Minolta wcd XML scraper ──────────────────────────────────
//
// bizhub MFPs expose a `/wcd/` family of XML endpoints. Common paths:
//   /wcd/system_device.xml     serial, model
//   /wcd/info_counter.xml      counters
//   /wcd/info_supply.xml       toner / drum / waste
//
// Newer firmware sometimes requires authentication; we try anonymous
// first, then fall back to whatever credentials the operator gave us.

export async function scrapeKonicaMinolta(
  http: AxiosInstance,
  ipAddress: string,
  options: { protocol?: 'http' | 'https'; port?: number; username?: string; password?: string },
): Promise<Partial<DeviceMetrics>> {
  const proto = options.protocol || 'https';
  const port = options.port || (proto === 'https' ? 443 : 80);
  const base = `${proto}://${ipAddress}${port === (proto === 'https' ? 443 : 80) ? '' : ':' + port}`;
  const auth = { username: options.username, password: options.password };

  const [systemXml, counterXml, supplyXml] = await Promise.all([
    tryGet(http, `${base}/wcd/system_device.xml`, auth),
    tryGet(http, `${base}/wcd/info_counter.xml`, auth),
    tryGet(http, `${base}/wcd/info_supply.xml`, auth),
  ]);

  const serialNumber = systemXml
    ? xmlFirst('SerialNumber', systemXml) || xmlFirst('SerialNo', systemXml)
    : undefined;
  const model = systemXml
    ? xmlFirst('ProductName', systemXml) || xmlFirst('ModelName', systemXml)
    : undefined;

  const meters: MeterReadings = {};
  if (counterXml) {
    meters.totalImpressions = asNumber(xmlFirst('TotalCounter', counterXml));
    meters.bwImpressions = asNumber(
      xmlFirst('BlackCounter', counterXml) || xmlFirst('MonoCounter', counterXml),
    );
    meters.colorImpressions = asNumber(
      xmlFirst('ColorCounter', counterXml) || xmlFirst('FullColorCounter', counterXml),
    );
    meters.largeImpressions = asNumber(
      xmlFirst('LargeCounter', counterXml) || xmlFirst('LargeSizeCounter', counterXml),
    );
  }

  const tonerLevels: TonerLevels = {};
  if (supplyXml) {
    // Konica's supply XML uses <Toner><Color>K|C|M|Y</Color><Level>n</Level></Toner>
    const blocks = supplyXml.split(/<\/(?:[a-zA-Z0-9-]+:)?Toner>/);
    for (const block of blocks) {
      const colour = xmlFirst('Color', block) || xmlFirst('TonerColor', block);
      const level = asNumber(xmlFirst('Level', block) || xmlFirst('Remaining', block));
      const mapped = colour ? labelToColour(colour) : null;
      if (mapped && level !== undefined) tonerLevels[mapped] = level;
    }
  }

  return {
    serialNumber: serialNumber?.trim() || `KM-${ipAddress}`,
    ipAddress,
    manufacturer: 'Konica Minolta',
    model: model?.trim(),
    tonerLevels,
    meters,
    deviceStatus: 'online',
    collectionTimestamp: new Date().toISOString(),
    rawData: {
      via: 'http',
      hadSystemXml: Boolean(systemXml),
      hadCounterXml: Boolean(counterXml),
      hadSupplyXml: Boolean(supplyXml),
    },
  };
}

// ── Dispatch table ───────────────────────────────────────────────────
//
// The map's `null` entries are placeholders — the vendor is recognised
// by sysObjectID/sysDescr but we don't have a HTTP scraper yet. The
// http-collector treats null as "fall back to generic probe".

export type VendorScraper = (
  http: AxiosInstance,
  ipAddress: string,
  options: { protocol?: 'http' | 'https'; port?: number; username?: string; password?: string },
) => Promise<Partial<DeviceMetrics>>;

export const VENDOR_SCRAPERS: Partial<Record<Vendor, VendorScraper>> = {
  hp: scrapeHp,
  konicaMinolta: scrapeKonicaMinolta,
  // Stubs (intentionally absent — fall back to generic):
  //   canon, xerox, ricoh, brother, lexmark, sharp, toshiba, epson, kyocera, oki, samsung
  // Each of those has well-documented endpoints but they vary widely
  // by model family. Add scrapers as you onboard real fleets.
};
