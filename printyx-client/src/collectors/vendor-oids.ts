// Vendor and standard MIB OIDs for printer monitoring.
//
// Two sources of truth:
//   1. RFC 3805 (Printer-MIB) — the standard. Every modern printer SHOULD
//      respond to these. Fields available: marker supplies, paper trays,
//      total impressions via prtMarkerLifeCount.
//   2. Vendor enterprise OIDs — needed when the standard MIB doesn't
//      report split B&W vs colour counters or when a vendor exposes
//      counter values only under their private branch.
//
// Vendor detection prefers `sysObjectID` (an OID prefix that maps to the
// IANA-registered enterprise number) over parsing `sysDescr`. sysObjectID
// is a contractual identifier; sysDescr is free-form marketing text and
// changes between firmware revisions.
//
// IMPORTANT: the vendor-counter OIDs below are correct for common models
// but not for every variant in a vendor's catalogue. Where a counter
// fails, we fall back to a walk of `prtMarkerLifeCount` (Printer-MIB).

// ── Standard Printer-MIB (RFC 3805) ──────────────────────────────────
export const PRINTER_MIB = {
  // Device identity
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysName: '1.3.6.1.2.1.1.5.0',

  // Per-host (one row per logical printer; index 1 covers nearly all single-engine devices)
  hrDeviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',
  prtGeneralSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',

  // Marker life count — per-marker total impressions. Walk this; some
  // devices expose a single counter, others one per engine (colour + mono).
  prtMarkerLifeCount: '1.3.6.1.2.1.43.10.2.1.4',
  prtMarkerCounterUnit: '1.3.6.1.2.1.43.10.2.1.3', // 7 = impressions, 8 = sheets
  prtMarkerProcessColorants: '1.3.6.1.2.1.43.10.2.1.7', // # of process colorants
  prtMarkerColorantValue: '1.3.6.1.2.1.43.12.1.1.4', // colorant labels by index

  // Marker supplies (toner, ink, drum, fuser, …)
  prtMarkerSuppliesEntry: '1.3.6.1.2.1.43.11.1.1',
  prtMarkerSuppliesType: '1.3.6.1.2.1.43.11.1.1.5', // see SupplyType below
  prtMarkerSuppliesDescription: '1.3.6.1.2.1.43.11.1.1.6',
  prtMarkerSuppliesSupplyUnit: '1.3.6.1.2.1.43.11.1.1.7',
  prtMarkerSuppliesMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8',
  prtMarkerSuppliesLevel: '1.3.6.1.2.1.43.11.1.1.9',
  prtMarkerSuppliesClass: '1.3.6.1.2.1.43.11.1.1.4', // 3 = supplyThatIsConsumed, 4 = receptacleThatIsFilled
  prtMarkerSuppliesColorantIndex: '1.3.6.1.2.1.43.11.1.1.3',

  // Input trays (paper)
  prtInputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10',
  prtInputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9',
  prtInputName: '1.3.6.1.2.1.43.8.2.1.13',
} as const;

// RFC 3805 prtMarkerSuppliesType values that we surface
export const SupplyType: Record<number, string> = {
  3: 'toner',
  4: 'wasteToner',
  5: 'ink',
  6: 'inkCartridge',
  7: 'inkRibbon',
  8: 'wasteInk',
  9: 'opc',
  10: 'developer',
  11: 'fuserOil',
  12: 'solidWax',
  13: 'ribbonWax',
  14: 'wasteWax',
  15: 'fuser',
  16: 'coronaWire',
  17: 'fuserOilWick',
  18: 'cleanerUnit',
  19: 'fuserCleaningPad',
  20: 'transferUnit',
  21: 'tonerCartridge',
  22: 'fuserOiler',
  23: 'water',
  24: 'wasteWater',
  25: 'wasteCartridge',
  26: 'wasteOil',
  27: 'oicEcoboxCartridge',
  28: 'cleanerKit',
  29: 'maintenanceKit',
  30: 'feederUnit',
  31: 'staples',
  32: 'binderInk',
  33: 'patchInk',
  35: 'paper',
  36: 'envelope',
  // ... full list in RFC 3805 §3.6.4
};

// ── IANA enterprise prefixes → canonical vendor name ─────────────────
// We match by *prefix* of sysObjectID. Map keys are the OID up to the
// vendor's enterprise number; everything below identifies the model.
const SYS_OBJECT_ID_VENDORS: ReadonlyArray<{ prefix: string; vendor: Vendor }> = [
  { prefix: '1.3.6.1.4.1.11.', vendor: 'hp' }, // Hewlett-Packard
  { prefix: '1.3.6.1.4.1.1602.', vendor: 'canon' },
  { prefix: '1.3.6.1.4.1.253.', vendor: 'xerox' },
  { prefix: '1.3.6.1.4.1.367.', vendor: 'ricoh' },
  { prefix: '1.3.6.1.4.1.18334.', vendor: 'konicaMinolta' },
  { prefix: '1.3.6.1.4.1.641.', vendor: 'lexmark' },
  { prefix: '1.3.6.1.4.1.2435.', vendor: 'brother' },
  { prefix: '1.3.6.1.4.1.1532.', vendor: 'sharp' },
  { prefix: '1.3.6.1.4.1.1129.', vendor: 'toshiba' },
  { prefix: '1.3.6.1.4.1.1248.', vendor: 'epson' },
  { prefix: '1.3.6.1.4.1.1347.', vendor: 'kyocera' },
  { prefix: '1.3.6.1.4.1.2001.', vendor: 'oki' },
  { prefix: '1.3.6.1.4.1.236.', vendor: 'samsung' },
];

export type Vendor =
  | 'hp'
  | 'canon'
  | 'xerox'
  | 'ricoh'
  | 'konicaMinolta'
  | 'lexmark'
  | 'brother'
  | 'sharp'
  | 'toshiba'
  | 'epson'
  | 'kyocera'
  | 'oki'
  | 'samsung'
  | 'unknown';

export const VendorDisplayName: Record<Vendor, string> = {
  hp: 'HP',
  canon: 'Canon',
  xerox: 'Xerox',
  ricoh: 'Ricoh',
  konicaMinolta: 'Konica Minolta',
  lexmark: 'Lexmark',
  brother: 'Brother',
  sharp: 'Sharp',
  toshiba: 'Toshiba',
  epson: 'Epson',
  kyocera: 'Kyocera',
  oki: 'OKI',
  samsung: 'Samsung',
  unknown: 'Unknown',
};

/**
 * Detect vendor. Preferred path is sysObjectID (a contractual prefix).
 * sysDescr is a fragile free-text fallback for devices that don't
 * advertise an obvious sysObjectID.
 */
export function detectVendor(sysObjectID?: string, sysDescr?: string): Vendor {
  if (sysObjectID) {
    const oid = sysObjectID.startsWith('.') ? sysObjectID.slice(1) : sysObjectID;
    const match = SYS_OBJECT_ID_VENDORS.find((v) => oid.startsWith(v.prefix));
    if (match) return match.vendor;
  }
  if (sysDescr) {
    const lower = sysDescr.toLowerCase();
    if (lower.includes('hewlett') || /\bhp\b/.test(lower)) return 'hp';
    if (lower.includes('canon')) return 'canon';
    if (lower.includes('xerox')) return 'xerox';
    if (lower.includes('ricoh')) return 'ricoh';
    if (lower.includes('konica') || lower.includes('bizhub')) return 'konicaMinolta';
    if (lower.includes('lexmark')) return 'lexmark';
    if (lower.includes('brother')) return 'brother';
    if (lower.includes('sharp')) return 'sharp';
    if (lower.includes('toshiba')) return 'toshiba';
    if (lower.includes('epson')) return 'epson';
    if (lower.includes('kyocera') || lower.includes('taskalfa') || lower.includes('ecosys'))
      return 'kyocera';
    if (lower.includes('oki') || lower.includes('okidata')) return 'oki';
    if (lower.includes('samsung')) return 'samsung';
  }
  return 'unknown';
}

// ── Vendor counter OID maps ──────────────────────────────────────────
//
// Each vendor map describes how to read total / B&W / colour counters.
// The map can be empty — in that case the collector falls back to a
// walk of prtMarkerLifeCount.
//
// Sources:
//  - HP MIB documents (HP-PRINT-MIB)
//  - Canon Print MIB Reference (cprtCntServ)
//  - Xerox WCM (xeroxAdminGroup)
//  - Ricoh Print SNMP MIB (printerInfo)
//  - Konica Minolta bizhub OpenAPI MIB
//  - Lexmark Print MIB
//  - Kyocera MIB Reference (KM-MIB-XHIR)
//  - Brother Print MIB
//
// Where a vendor's catalogue genuinely uses different OIDs for different
// device families, prefer the most common modern OID and rely on the
// fallback walk for older or outlier models.

export interface VendorCounterOids {
  total?: string;
  bw?: string;
  color?: string;
  large?: string; // A3/Ledger (only some Konica/Ricoh/Xerox MFPs)
  serialNumber?: string;
}

export const VENDOR_COUNTERS: Record<Exclude<Vendor, 'unknown'>, VendorCounterOids> = {
  hp: {
    // HP enterprise printer life count is a sub-tree; many HP MFPs expose
    // these as scalar OIDs. The walk fallback covers the rest.
    total: '1.3.6.1.4.1.11.2.3.9.4.2.1.4.1.10.5.0',
    bw: '1.3.6.1.4.1.11.2.3.9.4.2.1.4.1.10.110.0',
    color: '1.3.6.1.4.1.11.2.3.9.4.2.1.4.1.10.111.0',
    serialNumber: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0',
  },

  canon: {
    total: '1.3.6.1.4.1.1602.1.11.1.3.1.4.101',
    bw: '1.3.6.1.4.1.1602.1.11.1.3.1.4.102',
    color: '1.3.6.1.4.1.1602.1.11.1.3.1.4.103',
    large: '1.3.6.1.4.1.1602.1.11.1.3.1.4.301',
    serialNumber: '1.3.6.1.4.1.1602.1.2.1.4.0',
  },

  xerox: {
    total: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1',
    bw: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.33',
    color: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.34',
    large: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.124',
  },

  ricoh: {
    total: '1.3.6.1.4.1.367.3.2.1.2.19.5.1.5.1',
    bw: '1.3.6.1.4.1.367.3.2.1.2.19.5.1.9.1.1',
    color: '1.3.6.1.4.1.367.3.2.1.2.19.5.1.9.1.2',
    serialNumber: '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
  },

  konicaMinolta: {
    // bizhub-series OIDs (newer MFPs). C series colour counters live
    // under a different sub-tree; covered by the fallback walk.
    total: '1.3.6.1.4.1.18334.1.1.1.5.7.2.2.1.5.1.1',
    bw: '1.3.6.1.4.1.18334.1.1.1.5.7.2.2.1.5.1.2',
    color: '1.3.6.1.4.1.18334.1.1.1.5.7.2.2.1.5.1.3',
    large: '1.3.6.1.4.1.18334.1.1.1.5.7.2.2.1.5.1.4',
  },

  lexmark: {
    // Lexmark Print MIB — life counters
    total: '1.3.6.1.4.1.641.6.5.5.1.1.0',
    bw: '1.3.6.1.4.1.641.6.5.5.2.1.0',
    color: '1.3.6.1.4.1.641.6.5.5.3.1.0',
  },

  brother: {
    total: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.43.0',
    serialNumber: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.17.0',
  },

  sharp: {
    total: '1.3.6.1.4.1.1532.2.1.6.1.4.1.1',
    bw: '1.3.6.1.4.1.1532.2.1.6.1.4.1.2',
    color: '1.3.6.1.4.1.1532.2.1.6.1.4.1.3',
  },

  toshiba: {
    // Toshiba e-STUDIO; counter sub-tree varies per controller (ARM/GA-1140 etc).
    // Prefer fallback walk for accuracy.
    total: '1.3.6.1.4.1.1129.2.4.1.5.36.0',
  },

  epson: {
    total: '1.3.6.1.4.1.1248.1.2.2.27.1.1.4.1.7.1.1',
  },

  kyocera: {
    // Kyocera KM-MIB-XHIR — TASKalfa / ECOSYS
    total: '1.3.6.1.4.1.1347.42.3.1.1.1.1.1',
    bw: '1.3.6.1.4.1.1347.42.3.1.2.1.1.1.1',
    color: '1.3.6.1.4.1.1347.42.3.1.2.1.1.1.2',
    large: '1.3.6.1.4.1.1347.42.3.1.2.1.1.1.4',
    serialNumber: '1.3.6.1.4.1.1347.43.5.1.1.28.1',
  },

  oki: {
    total: '1.3.6.1.4.1.2001.1.1.1.1.11.1.10.45.0',
  },

  samsung: {
    total: '1.3.6.1.4.1.236.11.5.11.81.11.1.1.5.1.1',
    bw: '1.3.6.1.4.1.236.11.5.11.81.11.1.1.5.1.2',
    color: '1.3.6.1.4.1.236.11.5.11.81.11.1.1.5.1.3',
  },
};

/** Lookup helper that returns an empty object for unknown vendors. */
export function counterOidsFor(vendor: Vendor): VendorCounterOids {
  if (vendor === 'unknown') return {};
  return VENDOR_COUNTERS[vendor] || {};
}
