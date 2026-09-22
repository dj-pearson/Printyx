/**
 * Is this installation's configuration set up before the technician leaves?
 * (WF-L-11.)
 *
 * Two questions a technician finishing the network functional check has no way
 * to answer today, because both live on admin pages nobody sends them to:
 *
 *   1. Will meter scraping work? printer monitoring polls SNMP through an
 *      `oid_mappings` row chosen by manufacturer and model series. No row, no
 *      meters - and no meters means no volume, no cost-per-page and no
 *      automatic billing for that machine, discovered a month later when the
 *      invoice is short.
 *   2. Will scan-to-email work? An MFP that scans needs an address book, and
 *      `address_books` is keyed on (tenant, customer). No book, and the scan
 *      button on the panel goes nowhere on day one.
 *
 * Both are READ-ONLY EXISTENCE CHECKS over tables that already exist. Nothing
 * here writes, and nothing here decides: a missing mapping is reported with a
 * link to the page that adds one.
 *
 * COVERAGE IS A RESOLUTION PROBLEM, NOT AN EQUALITY CHECK, and this repo has
 * paid for getting that wrong twice (COP-B10's competitor names, COP-B09's
 * territories). `oid_mappings.model_series` is FREE TEXT and NULLABLE:
 *
 *   manufacturer='Canon'  model_series='imageRUNNER ADVANCE'  -> that series
 *   manufacturer='Canon'  model_series=null                   -> every Canon
 *   manufacturer='Xerox'  model_series='VersaLink/AltaLink'   -> either series
 *
 * so the seeded catalogue already carries a slash-separated list and a
 * covers-everything null. Matching is substring-on-token-boundary against a
 * normalized model, deliberately NOT fuzzy: an abbreviation an admin wrote
 * ('iR-ADV' for 'imageRUNNER ADVANCE') will not match, and the right outcome
 * there is a visible gap the admin closes with one row, not a guess that
 * silently points a machine at the wrong OID bundle and reports meters that
 * belong to a different counter.
 *
 * THREE OUTCOMES, NOT TWO. 'unknown' is separate from 'none' because a device
 * whose manufacturer or model nobody typed in has not been checked - the
 * NULL IS NOT ZERO rule applied to coverage. A screen that renders "not set up"
 * over a blank model field is telling a technician to go fix something that is
 * not broken.
 *
 * A MANUFACTURER-WIDE MAPPING IS COVERAGE AND SAYS SO. A generic Canon bundle
 * really is what monitoring would poll with, so it is not a gap; it is also not
 * as good as a series-specific one, so the basis travels with the answer and
 * the panel can say which it got.
 */

export interface OidMappingRow {
  id?: number | string | null;
  manufacturer?: string | null;
  model_series?: string | null;
  mapping_name?: string | null;
  is_default?: boolean | null;
}

export interface DeviceRef {
  manufacturer?: string | null;
  model?: string | null;
  /** Free-form; only used by requiresScanToEmail. */
  equipmentType?: string | null;
  features?: string[] | null;
  smtpName?: string | null;
}

export type CoverageBasis = 'model-series' | 'manufacturer-default' | 'none' | 'unknown';

export interface DeviceCoverage {
  manufacturer: string | null;
  model: string | null;
  basis: CoverageBasis;
  /** The mapping that would be used, when one resolves. */
  mappingName: string | null;
  mappingId: string | number | null;
  /** The series text that matched, so an admin can see WHY it matched. */
  matchedSeries: string | null;
}

export interface OidCoverageSummary {
  devices: DeviceCoverage[];
  covered: number;
  uncovered: number;
  unknown: number;
  /** Nothing in the catalogue at all - a different problem from a gap in it. */
  catalogueEmpty: boolean;
}

const blank = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Lowercase, punctuation to SPACE (not to nothing - 'iR-ADV' must not become
 * 'iradv', which would match inside unrelated words), collapse runs.
 *
 * PERIODS AND APOSTROPHES GO FIRST AND GO TO NOTHING, because they sit INSIDE
 * a word rather than between two: 'Canon U.S.A., Inc.' has to reduce to
 * 'canon usa inc' so the suffix strip below can see 'usa', and turning the
 * dots into spaces gives 'u s a', which it cannot.
 */
export function normalizeText(value: unknown): string {
  const text = blank(value);
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Corporate suffixes only, and only when something else remains. A dealer
 * writes 'Canon U.S.A., Inc.' on one record and 'Canon' on the next; those are
 * one manufacturer. Nothing else is stripped - COP-B10's rule that a normalizer
 * must not remove distinguishing words, because 'HP' and 'HP Enterprise' may
 * genuinely be two catalogues.
 */
const CORPORATE_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'co',
  'company',
  'ltd',
  'limited',
  'llc',
  'gmbh',
  'ag',
  'sa',
  'usa',
  'america',
]);

export function normalizeManufacturer(value: unknown): string {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  while (tokens.length > 1 && CORPORATE_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

/**
 * One row's model_series can name several series. The seeded Xerox row is
 * 'VersaLink/AltaLink', so a slash is a list separator in data that already
 * exists; a comma is the other spelling an admin reaches for.
 */
export function seriesVariants(modelSeries: unknown): string[] {
  const text = blank(modelSeries);
  if (!text) return [];
  return text
    .split(/[/,]/)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

/** Does `model` contain `series` at token boundaries? */
export function modelMatchesSeries(model: string, series: string): boolean {
  if (!series) return false;
  if (!model) return false;
  return ` ${model} `.includes(` ${series} `) || model === series;
}

/**
 * Pick the mapping printer monitoring would use for one device.
 *
 * Specificity first: a series match beats a manufacturer-wide row, and a LONGER
 * series beats a shorter one ('imageRUNNER ADVANCE DX' over 'imageRUNNER'), so
 * adding a narrower mapping takes effect rather than losing a coin toss.
 * `is_default` breaks what is left, then the row id, so the answer is stable
 * across requests instead of following PostgREST's row order.
 */
export function resolveOidCoverage(device: DeviceRef, mappings: OidMappingRow[]): DeviceCoverage {
  const manufacturer = blank(device.manufacturer);
  const model = blank(device.model);

  // 'Unknown' is what the form's own equipment default writes into the
  // manufacturer field, so it is an absence wearing a value.
  const manufacturerKey =
    manufacturer && normalizeManufacturer(manufacturer) !== 'unknown'
      ? normalizeManufacturer(manufacturer)
      : '';

  if (!manufacturerKey || !model) {
    return {
      manufacturer,
      model,
      basis: 'unknown',
      mappingName: null,
      mappingId: null,
      matchedSeries: null,
    };
  }

  const modelKey = normalizeText(model);
  const ofManufacturer = mappings.filter(
    (m) => normalizeManufacturer(m.manufacturer) === manufacturerKey,
  );

  type Candidate = { row: OidMappingRow; series: string | null; length: number };
  const candidates: Candidate[] = [];
  for (const row of ofManufacturer) {
    const variants = seriesVariants(row.model_series);
    if (variants.length === 0) {
      candidates.push({ row, series: null, length: 0 });
      continue;
    }
    const hit = variants
      .filter((series) => modelMatchesSeries(modelKey, series))
      .sort((a, b) => b.length - a.length)[0];
    if (hit) candidates.push({ row, series: hit, length: hit.length });
  }

  if (candidates.length === 0) {
    return {
      manufacturer,
      model,
      basis: 'none',
      mappingName: null,
      mappingId: null,
      matchedSeries: null,
    };
  }

  candidates.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const aDefault = a.row.is_default === true ? 0 : 1;
    const bDefault = b.row.is_default === true ? 0 : 1;
    if (aDefault !== bDefault) return aDefault - bDefault;
    return String(a.row.id ?? '').localeCompare(String(b.row.id ?? ''));
  });

  const best = candidates[0];
  return {
    manufacturer,
    model,
    basis: best.series ? 'model-series' : 'manufacturer-default',
    mappingName: blank(best.row.mapping_name),
    mappingId: best.row.id ?? null,
    matchedSeries: best.series,
  };
}

export function summariseOidCoverage(
  devices: DeviceRef[],
  mappings: OidMappingRow[],
): OidCoverageSummary {
  const resolved = devices.map((device) => resolveOidCoverage(device, mappings));
  return {
    devices: resolved,
    covered: resolved.filter(
      (d) => d.basis === 'model-series' || d.basis === 'manufacturer-default',
    ).length,
    uncovered: resolved.filter((d) => d.basis === 'none').length,
    unknown: resolved.filter((d) => d.basis === 'unknown').length,
    catalogueEmpty: mappings.length === 0,
  };
}

export interface ScanRequirement {
  required: boolean;
  /** Which devices drove the answer, so the panel can name them. */
  devices: string[];
  /** Why, in the words the panel prints - a derivation, not a stored flag. */
  reason: string;
}

const SCANNING_TYPES = new Set(['mfp', 'scanner']);

/**
 * NOTHING ON THIS FORM ASKS "does this site use scan-to-email". There is no
 * such column and no such checkbox, so the answer is DERIVED and says so: a
 * device typed as an MFP or a scanner, a feature naming scan, or an SMTP name
 * the installer already filled in. That derivation is stated on screen rather
 * than presented as a fact the system holds, because an over-eager address-book
 * warning on a fleet of plain printers trains people to ignore the panel.
 */
export function requiresScanToEmail(devices: DeviceRef[]): ScanRequirement {
  const matched: string[] = [];
  for (const device of devices) {
    const type = normalizeText(device.equipmentType);
    const scansByType = SCANNING_TYPES.has(type);
    const scansByFeature = (device.features ?? []).some((f) => /scan/i.test(String(f ?? '')));
    const scansBySmtp = Boolean(blank(device.smtpName));
    if (scansByType || scansByFeature || scansBySmtp) {
      matched.push(blank(device.model) || blank(device.manufacturer) || 'Unnamed device');
    }
  }
  if (matched.length === 0) {
    return {
      required: false,
      devices: [],
      reason: 'No device on this checklist is typed as an MFP or scanner, or names an SMTP host.',
    };
  }
  return {
    required: true,
    devices: matched,
    reason:
      'Derived from the equipment step: a device typed as an MFP or scanner, carrying a scan ' +
      'feature, or given an SMTP name. There is no scan-to-email field on the checklist.',
  };
}
