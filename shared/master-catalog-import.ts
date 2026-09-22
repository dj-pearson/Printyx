/**
 * Master catalogue CSV import: header mapping, row shaping and duplicate merge.
 *
 * ONE MODULE RATHER THAN A PARITY TEST. Both hosts serve `/api/catalog`, so the
 * Express router imports this with `@shared/...` and the Deno edge function with
 * a relative path. The print-cost calculator and the GPT-5 prompts each ship as
 * two near-verbatim copies held together by a test; that costs a standing
 * instruction nobody is obliged to read. Where both runtimes can import the same
 * file, they should.
 *
 * Three defects the previous, duplicated implementation carried:
 *
 *  1. It split the file on newlines and parsed each line on its own, so a quoted
 *     field containing a newline - a product description pasted out of a
 *     spreadsheet - ended the record early and shifted every remaining column.
 *     `parseCsv` from ./catalog-import is a real parser and is used instead.
 *  2. Money went through `parseFloat`, which reads '12abc' as 12 and '1.234.56'
 *     as 1.234. A junk cell became a PRICE rather than an absent one, and a
 *     price in this catalogue is what a quote is built from, so a wrong number
 *     is worse than a blank. `Number()` on the cleaned string rejects both.
 *  3. Duplicate rows inside one file were merged and the merge was never
 *     reported, so an operator could not tell a 400-row file that produced 400
 *     products from one that produced 250. `duplicatesMerged` is counted.
 */
import { parseCsv } from './catalog-import';

/** Header synonyms per catalogue field, matched case-insensitively after trim. */
const HEADER_PATTERNS: Record<string, string[]> = {
  modelCode: [
    'item no',
    'item no.',
    'model',
    'model code',
    'model_code',
    'product code',
    'sku',
    'part number',
    'part no',
  ],
  displayName: [
    'description',
    'name',
    'product name',
    'model name',
    'model_name',
    'display name',
    'display_name',
    'title',
  ],
  msrp: ['msrp', 'msrp_usd', 'retail price', 'list price', 'suggested retail price'],
  dealerCost: ['dealer price', 'dealer cost', 'cost', 'wholesale price', 'buy price'],
  manufacturer: ['manufacturer', 'brand', 'make'],
  category: ['category', 'type', 'product type', 'class'],
  status: ['status', 'state', 'active'],
};

const REQUIRED_FIELDS = ['modelCode', 'displayName'];

export interface MasterCatalogFieldMappings {
  /** At least one of modelCode / displayName resolved to a header. */
  isValid: boolean;
  /** field -> the header (as written in the file) it was matched to. */
  mappings: Record<string, string>;
  /** field -> the closest header, for a file we could not map. */
  suggestions: Record<string, string>;
  headersFound: string[];
  requiredFieldsFound: number;
}

export interface MasterCatalogImportRow {
  manufacturer: string;
  modelCode: string;
  displayName: string;
  msrp?: number;
  dealerCost?: number;
  category: string;
  productType: string;
  status: string;
}

export type MasterCatalogImportRefusal = 'EMPTY_CSV' | 'NO_DATA_ROWS' | 'UNMAPPABLE_HEADERS';

export interface MasterCatalogImportPlan {
  ok: boolean;
  reason?: MasterCatalogImportRefusal;
  message?: string;
  fieldMappings: MasterCatalogFieldMappings;
  /** Data rows read from the file, before de-duplication. */
  totalRows: number;
  /** One entry per (manufacturer, modelCode), later rows filling earlier blanks. */
  rows: MasterCatalogImportRow[];
  /** Rows folded into an earlier row with the same key. */
  duplicatesMerged: number;
  /** Rows refused, each naming its line number. */
  errors: string[];
}

/**
 * Consolidate the spellings a dealer price list uses for one category.
 *
 * Shared with the catalogue routers, which each carried their own copy - so
 * `/api/catalog/normalize-categories` and the import could disagree about what
 * a category is called while both claimed to normalise it.
 */
export function normalizeCategoryName(category: string): string {
  if (!category) return category;

  const lower = category.toLowerCase().trim();

  if (lower.includes('mfp') || lower.includes('multifunction')) {
    return 'Multifunction';
  }

  if (
    lower.includes('accessory') ||
    lower.includes('hardware accessory') ||
    lower.includes('paper feeding') ||
    lower.includes('document feeding')
  ) {
    return 'Accessory';
  }

  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

/**
 * Read a money cell.
 *
 * Returns undefined rather than a number whenever the cell is not wholly a
 * number once currency punctuation is removed: a cell nobody can read is an
 * absent price, never a guessed one.
 */
export function normalizeMoney(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Match each catalogue field against the file's headers. */
export function createFieldMappings(headers: string[]): MasterCatalogFieldMappings {
  const mappings: Record<string, string> = {};
  const suggestions: Record<string, string> = {};
  let requiredFieldsFound = 0;

  for (const [field, synonyms] of Object.entries(HEADER_PATTERNS)) {
    for (const header of headers) {
      if (synonyms.includes(header.toLowerCase().trim())) {
        mappings[field] = header;
        if (REQUIRED_FIELDS.includes(field)) requiredFieldsFound++;
        break;
      }
    }

    if (!mappings[field]) {
      const closest = headers.find((h) =>
        synonyms.some((term) => h.toLowerCase().includes(term.toLowerCase())),
      );
      if (closest) suggestions[field] = closest;
    }
  }

  return {
    // One of the two required fields is enough: a price list with an item
    // number and no description still carries products worth importing.
    isValid: requiredFieldsFound >= 1,
    mappings,
    suggestions,
    headersFound: headers,
    requiredFieldsFound,
  };
}

/** Shape one parsed record into the columns master_product_models carries. */
export function mapRowToProduct(
  record: Record<string, string>,
  fieldMappings: MasterCatalogFieldMappings,
): MasterCatalogImportRow {
  const at = (field: string): string => {
    const header = fieldMappings.mappings[field];
    return header ? (record[header] ?? '') : '';
  };

  const category = normalizeCategoryName(at('category') || 'General');

  return {
    // 'Unknown' is a visible sentinel, and it is also the dedup key, so a file
    // with no manufacturer column groups its rows together rather than each
    // row claiming a different maker.
    manufacturer: at('manufacturer') || 'Unknown',
    modelCode: at('modelCode'),
    displayName: at('displayName'),
    msrp: normalizeMoney(at('msrp')),
    dealerCost: normalizeMoney(at('dealerCost')),
    category,
    productType: category === 'Accessory' ? 'accessory' : 'model',
    status: at('status') || 'active',
  };
}

/** Fill blanks on `existing` from `incoming`; a value already present wins. */
export function mergeProductData(
  existing: MasterCatalogImportRow,
  incoming: MasterCatalogImportRow,
): MasterCatalogImportRow {
  const merged: Record<string, unknown> = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (!merged[key] && value) merged[key] = value;
  }

  return merged as unknown as MasterCatalogImportRow;
}

/** The key two rows must share to be treated as one product. */
export function importRowKey(row: MasterCatalogImportRow): string {
  return `${row.manufacturer}-${row.modelCode}`;
}

/**
 * Turn a CSV file into the set of products it describes.
 *
 * Pure: it reads no database and decides nothing about what already exists.
 * The caller compares each row against the catalogue and creates or fills.
 */
export function planMasterCatalogImport(csvText: string): MasterCatalogImportPlan {
  const empty: MasterCatalogFieldMappings = {
    isValid: false,
    mappings: {},
    suggestions: {},
    headersFound: [],
    requiredFieldsFound: 0,
  };

  if (!csvText || !csvText.trim()) {
    return {
      ok: false,
      reason: 'EMPTY_CSV',
      message: 'CSV file is empty',
      fieldMappings: empty,
      totalRows: 0,
      rows: [],
      duplicatesMerged: 0,
      errors: [],
    };
  }

  const records = parseCsv(csvText);

  if (records.length === 0) {
    return {
      ok: false,
      reason: 'NO_DATA_ROWS',
      message: 'CSV file must have a header row and at least one data row',
      fieldMappings: empty,
      totalRows: 0,
      rows: [],
      duplicatesMerged: 0,
      errors: [],
    };
  }

  const headers = Object.keys(records[0]);
  const fieldMappings = createFieldMappings(headers);

  if (!fieldMappings.isValid) {
    return {
      ok: false,
      reason: 'UNMAPPABLE_HEADERS',
      message:
        `Required fields missing. Found headers: ${headers.join(', ')}. ` +
        'Need at least a model/item code or a name/description column.',
      fieldMappings,
      totalRows: records.length,
      rows: [],
      duplicatesMerged: 0,
      errors: [],
    };
  }

  const byKey = new Map<string, MasterCatalogImportRow>();
  const errors: string[] = [];
  let duplicatesMerged = 0;

  records.forEach((record, index) => {
    // +2: one for the header line, one to count from 1. This is the row number
    // a SPREADSHEET shows, which is what an operator has open - a cell holding
    // an embedded newline is one row there, however many lines it spans in a
    // text editor.
    const line = index + 2;
    const row = mapRowToProduct(record, fieldMappings);

    if (!row.modelCode || !row.displayName) {
      errors.push(`Row ${line}: missing required fields (model code or name)`);
      return;
    }

    const key = importRowKey(row);
    const existing = byKey.get(key);

    if (existing) {
      byKey.set(key, mergeProductData(existing, row));
      duplicatesMerged++;
      return;
    }

    byKey.set(key, row);
  });

  return {
    ok: true,
    fieldMappings,
    totalRows: records.length,
    rows: [...byKey.values()],
    duplicatesMerged,
    errors,
  };
}
