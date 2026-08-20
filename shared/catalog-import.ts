/**
 * Catalog CSV import: one spec per product type (PROD-014).
 *
 * The import is broken end to end, and the offered template is why. Three
 * separate defects, all live in dev before production is even considered:
 *
 *  1. THE PRODUCT MODELS TEMPLATE MATCHES ALMOST NOTHING. It offers Standard
 *     Cost, Standard Rep Price, New Cost, Upgrade Cost, Model, Color Print,
 *     BW Print, Color Copy and BW Copy — the parser reads none of them — and
 *     omits MSRP, New Rep Price, Upgrade Rep Price and the active flags, which
 *     the parser does read. Fill in the template Printyx hands you and every
 *     price is silently dropped.
 *  2. THE ACCESSORIES IMPORT READS SNAKE_CASE while its template offers Title
 *     Case, and reads row.accessoryCode for the code but row.accessory_name for
 *     the name — two casings in one object literal. Nothing the template
 *     produces lands.
 *  3. THE SUPPLIES PARSER WRITES A `description` COLUMN. supplies has no such
 *     column (it has summary/note/ea_notes).
 *
 * So the specs below are bound to the REAL Drizzle columns, verified in
 * catalog-import-spec.test.ts against getTableColumns, and BOTH the template
 * offered for download and the parser are generated from the same spec. A
 * column that does not exist cannot be offered, and a header that is offered
 * cannot be ignored.
 *
 * Shared copy (client + Express) — kept textually identical to
 * supabase/functions/_shared/catalog-import.ts.
 */

export type FieldKind = 'text' | 'number' | 'boolean' | 'list';

export interface ImportField {
  /** Column header in the CSV, as offered in the template. */
  header: string;
  /** The real database column it lands in. */
  column: string;
  kind: FieldKind;
  required?: boolean;
  /** Used when the cell is empty or absent. */
  fallback?: string | number | boolean | null;
  /** Example value for the downloadable template. */
  example?: string;
}

export interface ImportSpec {
  table: string;
  /** Columns identifying an existing row, for the skip-duplicates check. */
  dedupeBy: string[];
  fields: ImportField[];
  /** Columns set on every imported row regardless of the CSV. */
  constants?: Record<string, unknown>;
}

const CODE: ImportField = {
  header: 'Product Code',
  column: 'product_code',
  kind: 'text',
  required: true,
  example: 'PM-001',
};
const NAME: ImportField = {
  header: 'Product Name',
  column: 'product_name',
  kind: 'text',
  required: true,
  example: 'Canon imageRUNNER C3226i',
};

/** The four rep-price tiers most catalog tables share. */
function tierFields(tiers: string[]): ImportField[] {
  const out: ImportField[] = [];
  for (const tier of tiers) {
    const label = tier.charAt(0).toUpperCase() + tier.slice(1);
    out.push({
      header: `${label} Rep Price`,
      column: `${tier}_rep_price`,
      kind: 'number',
      example: '2999.00',
    });
    out.push({
      header: `${label} Active`,
      column: `${tier}_active`,
      kind: 'boolean',
      fallback: false,
      example: 'Yes',
    });
  }
  return out;
}

export const CATALOG_IMPORT_SPECS: Record<string, ImportSpec> = {
  'product-models': {
    table: 'product_models',
    dedupeBy: ['product_code', 'product_name'],
    constants: { is_active: true },
    fields: [
      CODE,
      NAME,
      {
        header: 'Category',
        column: 'category',
        kind: 'text',
        fallback: 'MFP',
        example: 'Multifunction',
      },
      { header: 'Manufacturer', column: 'manufacturer', kind: 'text', example: 'Canon' },
      {
        header: 'Description',
        column: 'description',
        kind: 'text',
        example: 'Multifunction color printer',
      },
      { header: 'Product Family', column: 'product_family', kind: 'text', example: 'imageRUNNER' },
      { header: 'MSRP', column: 'msrp', kind: 'number', example: '3499.00' },
      { header: 'Color Mode', column: 'color_mode', kind: 'text', example: 'Color' },
      { header: 'Color Speed', column: 'color_speed', kind: 'text', example: '26' },
      { header: 'BW Speed', column: 'bw_speed', kind: 'text', example: '26' },
      {
        header: 'Required Accessories',
        column: 'required_accessories',
        kind: 'list',
        example: 'PA-001;PA-002',
      },
      { header: 'New Cost', column: 'new_dealer_cost', kind: 'number', example: '2300.00' },
      { header: 'Upgrade Cost', column: 'upgrade_dealer_cost', kind: 'number', example: '1200.00' },
      { header: 'Lexmark Cost', column: 'lexmark_dealer_cost', kind: 'number', example: '2100.00' },
      ...tierFields(['new', 'upgrade', 'lexmark']),
    ],
  },

  'product-accessories': {
    table: 'product_accessories',
    dedupeBy: ['accessory_code'],
    constants: { is_active: true },
    fields: [
      {
        header: 'Product Code',
        column: 'accessory_code',
        kind: 'text',
        required: true,
        example: 'PA-001',
      },
      {
        header: 'Product Name',
        column: 'accessory_name',
        kind: 'text',
        required: true,
        example: 'Document Feeder DF-701',
      },
      {
        header: 'Accessory Type',
        column: 'accessory_type',
        kind: 'text',
        example: 'Document Feeder',
      },
      { header: 'Category', column: 'category', kind: 'text', example: 'Input' },
      { header: 'Manufacturer', column: 'manufacturer', kind: 'text', example: 'Canon' },
      {
        header: 'Description',
        column: 'description',
        kind: 'text',
        example: '50-sheet document feeder',
      },
      { header: 'Standard Cost', column: 'standard_cost', kind: 'number', example: '150.00' },
      {
        header: 'Standard Rep Price',
        column: 'standard_rep_price',
        kind: 'number',
        example: '199.00',
      },
      { header: 'New Cost', column: 'new_cost', kind: 'number', example: '140.00' },
      { header: 'New Rep Price', column: 'new_rep_price', kind: 'number', example: '189.00' },
      { header: 'Upgrade Cost', column: 'upgrade_cost', kind: 'number', example: '120.00' },
      {
        header: 'Upgrade Rep Price',
        column: 'upgrade_rep_price',
        kind: 'number',
        example: '159.00',
      },
    ],
  },

  'professional-services': {
    table: 'professional_services',
    dedupeBy: ['product_code'],
    constants: { is_active: true },
    fields: [
      CODE,
      NAME,
      { header: 'Category', column: 'category', kind: 'text', example: 'Installation' },
      {
        header: 'Service Type',
        column: 'accessory_type',
        kind: 'text',
        example: 'On-site Installation',
      },
      {
        header: 'Description',
        column: 'description',
        kind: 'text',
        example: 'Printer setup and configuration',
      },
      { header: 'Payment Type', column: 'payment_type', kind: 'text', example: 'One-time' },
      { header: 'MSRP', column: 'msrp', kind: 'number', example: '150.00' },
      ...tierFields(['new', 'upgrade', 'lexmark', 'graphic']),
    ],
  },

  'service-products': {
    table: 'service_products',
    dedupeBy: ['product_code'],
    constants: { is_active: true },
    fields: [
      CODE,
      NAME,
      { header: 'Category', column: 'category', kind: 'text', example: 'Maintenance' },
      {
        header: 'Service Type',
        column: 'service_type',
        kind: 'text',
        example: 'Preventive Maintenance',
      },
      { header: 'Pricing Level', column: 'pricing_level', kind: 'text', example: 'Standard' },
      {
        header: 'Description',
        column: 'description',
        kind: 'text',
        example: 'Regular maintenance service',
      },
      { header: 'Payment Type', column: 'payment_type', kind: 'text', example: 'Monthly' },
      ...tierFields(['new', 'upgrade', 'lexmark', 'graphic']),
    ],
  },

  'software-products': {
    table: 'software_products',
    dedupeBy: ['product_code'],
    constants: { is_active: true },
    fields: [
      CODE,
      NAME,
      { header: 'Vendor', column: 'vendor', kind: 'text', example: 'Canon' },
      { header: 'Product Type', column: 'product_type', kind: 'text', example: 'License' },
      { header: 'Category', column: 'category', kind: 'text', example: 'Document Management' },
      { header: 'Description', column: 'description', kind: 'text', example: 'Annual license' },
      { header: 'Payment Type', column: 'payment_type', kind: 'text', example: 'Annual' },
      { header: 'Standard Cost', column: 'standard_cost', kind: 'number', example: '400.00' },
      {
        header: 'Standard Rep Price',
        column: 'standard_rep_price',
        kind: 'number',
        example: '599.00',
      },
      { header: 'New Cost', column: 'new_cost', kind: 'number', example: '380.00' },
      { header: 'New Rep Price', column: 'new_rep_price', kind: 'number', example: '549.00' },
      { header: 'Upgrade Cost', column: 'upgrade_cost', kind: 'number', example: '300.00' },
      {
        header: 'Upgrade Rep Price',
        column: 'upgrade_rep_price',
        kind: 'number',
        example: '449.00',
      },
      {
        header: 'Standard Active',
        column: 'standard_active',
        kind: 'boolean',
        fallback: false,
        example: 'Yes',
      },
      {
        header: 'New Active',
        column: 'new_active',
        kind: 'boolean',
        fallback: false,
        example: 'Yes',
      },
      {
        header: 'Upgrade Active',
        column: 'upgrade_active',
        kind: 'boolean',
        fallback: false,
        example: 'Yes',
      },
    ],
  },

  supplies: {
    table: 'supplies',
    dedupeBy: ['product_code'],
    constants: { is_active: true, sales_rep_credit: true, funding: true },
    fields: [
      CODE,
      NAME,
      {
        header: 'Product Type',
        column: 'product_type',
        kind: 'text',
        fallback: 'Supplies',
        example: 'Toner',
      },
      { header: 'Dealer Comp', column: 'dealer_comp', kind: 'text', example: 'Standard' },
      { header: 'Inventory', column: 'inventory', kind: 'text', example: 'Stocked' },
      { header: 'In Stock', column: 'in_stock', kind: 'text', example: 'Yes' },
      // supplies has no description column; summary is the free-text one.
      { header: 'Summary', column: 'summary', kind: 'text', example: 'Black toner cartridge' },
      { header: 'Notes', column: 'note', kind: 'text', example: 'Yields 10k pages' },
      ...tierFields(['new', 'upgrade', 'lexmark', 'graphic']),
    ],
  },

  'managed-services': {
    table: 'managed_services',
    dedupeBy: ['product_code'],
    constants: { is_active: true, sales_rep_credit: true, funding: true },
    fields: [
      CODE,
      NAME,
      {
        header: 'Category',
        column: 'category',
        kind: 'text',
        fallback: 'IT Services',
        example: 'IT Services',
      },
      { header: 'Service Type', column: 'service_type', kind: 'text', example: 'Help Desk' },
      { header: 'Service Level', column: 'service_level', kind: 'text', example: 'Gold' },
      { header: 'Support Hours', column: 'support_hours', kind: 'text', example: '24/7' },
      { header: 'Response Time', column: 'response_time', kind: 'text', example: '4 hours' },
      {
        header: 'Remote Management',
        column: 'remote_mgmt',
        kind: 'boolean',
        fallback: false,
        example: 'Yes',
      },
      {
        header: 'Onsite Support',
        column: 'onsite_support',
        kind: 'boolean',
        fallback: false,
        example: 'Yes',
      },
      { header: 'Description', column: 'description', kind: 'text', example: 'Managed IT support' },
      ...tierFields(['new', 'upgrade', 'lexmark', 'graphic']),
    ],
  },
};

export const CATALOG_IMPORT_TYPES = Object.keys(CATALOG_IMPORT_SPECS);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Parse CSV text into header-keyed rows.
 *
 * Written here rather than taken from a library because both backends have to
 * agree, and Deno has no csv-parser. Handles quoted fields, doubled quotes
 * inside them, embedded commas and newlines, and CRLF.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  // Note on the BOM Excel writes: no explicit strip is needed. Headers and
  // cells are trimmed below, and String.trim() removes U+FEFF — verified by
  // mutation (removing an explicit strip changed nothing, so the strip was
  // dead code pretending to be a guard).
  const src = text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      // handled by the \n that follows, or ends the row on a lone CR
      if (src[i + 1] !== '\n') endRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) endRow();

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (cells[idx] ?? '').trim();
    });
    return record;
  });
}

/** The template offered for download: the header line plus one example row. */
export function buildCsvTemplate(type: string): string {
  const spec = CATALOG_IMPORT_SPECS[type];
  if (!spec) return '';
  const headers = spec.fields.map((f) => f.header);
  const example = spec.fields.map((f) => f.example ?? '');
  const quote = (v: string) =>
    v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  return `${headers.map(quote).join(',')}\n${example.map(quote).join(',')}`;
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

function parseBoolean(value: string): boolean {
  const v = value.toLowerCase().trim();
  return v === 'true' || v === 'yes' || v === 'y' || v === '1';
}

/** Money may carry a currency symbol and thousands separators. */
function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Accessory lists accept commas or semicolons; stored comma-separated. */
function parseList(value: string): string | null {
  const parts = value
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts.join(',') : null;
}

export interface RowResult {
  isValid: boolean;
  errors: string[];
  /** Keyed by real column name, ready to insert. */
  data: Record<string, unknown>;
}

/**
 * One CSV row against a type's spec.
 *
 * Headers are matched case-insensitively and ignoring spaces and underscores,
 * so 'Product Code', 'product_code' and 'productCode' all land — the three
 * spellings the existing importers each accepted a different subset of.
 */
export function validateRow(type: string, row: Record<string, string>): RowResult {
  const spec = CATALOG_IMPORT_SPECS[type];
  if (!spec) return { isValid: false, errors: [`Unknown product type: ${type}`], data: {} };

  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    normalized[k.toLowerCase().replace(/[\s_]/g, '')] = v;
  }
  const cell = (header: string): string =>
    (normalized[header.toLowerCase().replace(/[\s_]/g, '')] ?? '').trim();

  const errors: string[] = [];
  const data: Record<string, unknown> = { ...(spec.constants ?? {}) };

  for (const field of spec.fields) {
    const raw = cell(field.header);

    if (!raw) {
      if (field.required) errors.push(`${field.header} is required`);
      if (field.fallback !== undefined) data[field.column] = field.fallback;
      continue;
    }

    switch (field.kind) {
      case 'number': {
        const n = parseNumber(raw);
        if (n === null) errors.push(`${field.header} is not a number: ${raw}`);
        else data[field.column] = n;
        break;
      }
      case 'boolean':
        data[field.column] = parseBoolean(raw);
        break;
      case 'list':
        data[field.column] = parseList(raw);
        break;
      default:
        data[field.column] = raw;
    }
  }

  return { isValid: errors.length === 0, errors, data };
}
