// Software-products CSV import field spec (SOFT-IMPORT).
//
// Single source of truth for: the importable target fields, their aliases (so
// common/vendor CSV headers auto-map), and the header normalizer. Used by the
// SoftwareProducts mapping selector (client) and the Express importer. The
// Deno edge function (supabase/functions/software-products) replicates this list
// inline — keep them in sync.

export type ImportFieldType = 'string' | 'number' | 'boolean';

export interface SoftwareImportField {
  /** Canonical camelCase target field. */
  field: string;
  label: string;
  type: ImportFieldType;
  required?: boolean;
  /** Human header variants that should auto-map to this field. */
  aliases: string[];
}

// Normalize a header for matching: lowercase, strip everything but a-z0-9.
export function normalizeHeader(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export const SOFTWARE_IMPORT_FIELDS: SoftwareImportField[] = [
  {
    field: 'productCode',
    label: 'Product Code',
    type: 'string',
    required: true,
    aliases: [
      'productCode',
      'product_code',
      'code',
      'sku',
      'manufacturer code',
      'mfg code',
      'manufacturer part number',
      'item',
      'item no',
      'item number',
      'ad product code',
      'part number',
      'part no',
    ],
  },
  {
    field: 'productName',
    label: 'Product Name',
    type: 'string',
    required: true,
    aliases: [
      'productName',
      'product_name',
      'name',
      'title',
      'product description',
      'description',
      'software name',
      'item description',
    ],
  },
  {
    field: 'vendor',
    label: 'Vendor / Brand',
    type: 'string',
    aliases: ['vendor', 'brand', 'manufacturer', 'publisher', 'make'],
  },
  {
    field: 'productType',
    label: 'Product Type',
    type: 'string',
    aliases: ['productType', 'product_type', 'type'],
  },
  {
    field: 'category',
    label: 'Category',
    type: 'string',
    aliases: ['category', 'product category', 'model', 'group', 'family'],
  },
  {
    field: 'accessoryType',
    label: 'Accessory Type',
    type: 'string',
    aliases: ['accessoryType', 'accessory_type', 'accessory type'],
  },
  {
    field: 'paymentType',
    label: 'Payment Type',
    type: 'string',
    aliases: ['paymentType', 'payment_type', 'payment type', 'billing', 'term'],
  },
  {
    field: 'description',
    label: 'Description',
    type: 'string',
    aliases: ['description', 'sub description', 'subdescription', 'long description', 'details'],
  },
  {
    field: 'summary',
    label: 'Summary',
    type: 'string',
    aliases: ['summary', 'short description'],
  },
  {
    field: 'standardCost',
    label: 'Standard Cost (dealer)',
    type: 'number',
    aliases: [
      'standardCost',
      'standard_cost',
      'dealer price',
      'dealer cost',
      'cost',
      'our cost',
      'wholesale',
      'buy price',
    ],
  },
  {
    field: 'standardRepPrice',
    label: 'Standard Rep Price (sell)',
    type: 'number',
    aliases: [
      'standardRepPrice',
      'standard_rep_price',
      'msrp',
      'list price',
      'retail',
      'retail price',
      'rep price',
      'sell price',
      'price',
    ],
  },
  {
    field: 'newCost',
    label: 'New Cost',
    type: 'number',
    aliases: ['newCost', 'new_cost', 'new cost'],
  },
  {
    field: 'newRepPrice',
    label: 'New Rep Price',
    type: 'number',
    aliases: ['newRepPrice', 'new_rep_price', 'new rep price', 'new price'],
  },
  {
    field: 'upgradeCost',
    label: 'Upgrade Cost',
    type: 'number',
    aliases: ['upgradeCost', 'upgrade_cost', 'upgrade cost'],
  },
  {
    field: 'upgradeRepPrice',
    label: 'Upgrade Rep Price',
    type: 'number',
    aliases: ['upgradeRepPrice', 'upgrade_rep_price', 'upgrade rep price', 'upgrade price'],
  },
  {
    field: 'isActive',
    label: 'Active',
    type: 'boolean',
    aliases: ['isActive', 'is_active', 'active', 'enabled'],
  },
  {
    field: 'availableForAll',
    label: 'Available For All',
    type: 'boolean',
    aliases: ['availableForAll', 'available_for_all', 'available for all'],
  },
  {
    field: 'salesRepCredit',
    label: 'Sales Rep Credit',
    type: 'boolean',
    aliases: ['salesRepCredit', 'sales_rep_credit', 'sales rep credit'],
  },
  {
    field: 'funding',
    label: 'Funding',
    type: 'boolean',
    aliases: ['funding', 'fundable'],
  },
  {
    field: 'lease',
    label: 'Lease',
    type: 'boolean',
    aliases: ['lease', 'leasable'],
  },
];

// camelCase target field -> snake_case DB column.
export const SOFTWARE_FIELD_TO_COLUMN: Record<string, string> = {
  productCode: 'product_code',
  productName: 'product_name',
  vendor: 'vendor',
  productType: 'product_type',
  category: 'category',
  accessoryType: 'accessory_type',
  paymentType: 'payment_type',
  description: 'description',
  summary: 'summary',
  standardCost: 'standard_cost',
  standardRepPrice: 'standard_rep_price',
  newCost: 'new_cost',
  newRepPrice: 'new_rep_price',
  upgradeCost: 'upgrade_cost',
  upgradeRepPrice: 'upgrade_rep_price',
  isActive: 'is_active',
  availableForAll: 'available_for_all',
  salesRepCredit: 'sales_rep_credit',
  funding: 'funding',
  lease: 'lease',
};

/**
 * Suggest a target field for a CSV header (returns the field key or null).
 * Used to pre-fill the mapping selector. First exact-normalized alias wins.
 */
export function suggestFieldForHeader(header: string): string | null {
  const norm = normalizeHeader(header);
  if (!norm) return null;
  for (const f of SOFTWARE_IMPORT_FIELDS) {
    if (f.aliases.some((a) => normalizeHeader(a) === norm)) return f.field;
  }
  return null;
}

/** Treat empty / placeholder ("-", "n/a") codes as "no code" for dedupe. */
export function isMeaningfulCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const t = String(code).trim().toLowerCase();
  return t !== '' && t !== '-' && t !== '--' && t !== 'n/a' && t !== 'na' && t !== 'none';
}
