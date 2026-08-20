// PROD-014: the catalog CSV import is broken end to end, and the template the
// app offers for download is the reason.
//
// This is the check that would have caught all three defects: every column a
// spec names is verified against the real Drizzle table, and the offered
// template is generated from the same spec that parses the upload — so a
// column that does not exist cannot be offered, and a header that is offered
// cannot be ignored.
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import {
  CATALOG_IMPORT_SPECS,
  CATALOG_IMPORT_TYPES,
  buildCsvTemplate,
  parseCsv,
  validateRow,
} from '@shared/catalog-import';
import * as edge from '../../../supabase/functions/_shared/catalog-import';
import {
  productModels,
  productAccessories,
  professionalServices,
  serviceProducts,
  softwareProducts,
  supplies,
  managedServices,
} from '@shared/schema';

const TABLES: Record<string, unknown> = {
  'product-models': productModels,
  'product-accessories': productAccessories,
  'professional-services': professionalServices,
  'service-products': serviceProducts,
  'software-products': softwareProducts,
  supplies,
  'managed-services': managedServices,
};

const columnsOf = (table: unknown) =>
  new Set(
    Object.values(getTableColumns(table as never) as Record<string, { name: string }>).map(
      (c) => c.name,
    ),
  );

describe('every spec column is a real column', () => {
  it.each(CATALOG_IMPORT_TYPES)('%s', (type) => {
    const spec = CATALOG_IMPORT_SPECS[type];
    const real = columnsOf(TABLES[type]);
    for (const field of spec.fields) {
      expect(real.has(field.column), `${spec.table}.${field.column} (${field.header})`).toBe(true);
    }
    for (const column of Object.keys(spec.constants ?? {})) {
      expect(real.has(column), `${spec.table}.${column}`).toBe(true);
    }
    for (const column of spec.dedupeBy) {
      expect(real.has(column), `${spec.table}.${column}`).toBe(true);
    }
  });

  it('names a table that exists for every type', () => {
    for (const type of CATALOG_IMPORT_TYPES) expect(TABLES[type]).toBeDefined();
  });

  it('does not write the supplies description column that never existed', () => {
    // validateSupplyData set `description`; supplies has summary/note/ea_notes.
    expect(columnsOf(supplies).has('description')).toBe(false);
    expect(CATALOG_IMPORT_SPECS.supplies.fields.map((f) => f.column)).not.toContain('description');
  });
});

describe('the template and the parser cannot disagree', () => {
  it.each(CATALOG_IMPORT_TYPES)('%s round-trips its own template', (type) => {
    const rows = parseCsv(buildCsvTemplate(type));
    expect(rows).toHaveLength(1);
    const result = validateRow(type, rows[0]);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);

    // Every offered header lands in a column — the product-models template used
    // to offer nine that went nowhere.
    const spec = CATALOG_IMPORT_SPECS[type];
    for (const field of spec.fields) {
      if (field.example) expect(Object.keys(result.data)).toContain(field.column);
    }
  });

  it('offers a header for every field the parser reads', () => {
    for (const type of CATALOG_IMPORT_TYPES) {
      const headerLine = buildCsvTemplate(type).split('\n')[0];
      for (const field of CATALOG_IMPORT_SPECS[type].fields) {
        expect(headerLine, `${type}: ${field.header}`).toContain(field.header);
      }
    }
  });
});

describe('header spellings', () => {
  it('accepts Title Case, snake_case and camelCase alike', () => {
    // The accessories importer read row.accessoryCode for the code and
    // row.accessory_name for the name, while its template offered Title Case.
    // All three spellings now resolve.
    const expected = 'PA-9';
    for (const key of ['Product Code', 'product_code', 'productCode', 'PRODUCT CODE']) {
      const out = validateRow('product-accessories', { [key]: expected, 'Product Name': 'Feeder' });
      expect(out.data.accessory_code, key).toBe(expected);
    }
  });
});

describe('value parsing', () => {
  it('strips currency formatting from money', () => {
    const out = validateRow('product-models', {
      'Product Code': 'PM-1',
      'Product Name': 'X',
      MSRP: '$3,499.00',
    });
    expect(out.data.msrp).toBe(3499);
  });

  it('reports a non-numeric price rather than storing NaN', () => {
    const out = validateRow('product-models', {
      'Product Code': 'PM-1',
      'Product Name': 'X',
      MSRP: 'call for pricing',
    });
    expect(out.isValid).toBe(false);
    expect(out.errors[0]).toContain('MSRP');
    expect(out.data.msrp).toBeUndefined();
  });

  it('reads the booleans a person actually types', () => {
    for (const yes of ['Yes', 'yes', 'TRUE', 'true', '1', 'y']) {
      const out = validateRow('product-models', {
        'Product Code': 'PM-1',
        'Product Name': 'X',
        'New Active': yes,
      });
      expect(out.data.new_active, yes).toBe(true);
    }
    for (const no of ['No', 'false', '0', 'nope']) {
      const out = validateRow('product-models', {
        'Product Code': 'PM-1',
        'Product Name': 'X',
        'New Active': no,
      });
      expect(out.data.new_active, no).toBe(false);
    }
  });

  it('accepts commas or semicolons in an accessory list', () => {
    for (const raw of ['PA-1, PA-2', 'PA-1;PA-2', ' PA-1 ; PA-2 ']) {
      const out = validateRow('product-models', {
        'Product Code': 'PM-1',
        'Product Name': 'X',
        'Required Accessories': raw,
      });
      expect(out.data.required_accessories, raw).toBe('PA-1,PA-2');
    }
  });

  it('requires the two identifying columns', () => {
    const out = validateRow('product-models', { 'Product Name': 'X' });
    expect(out.isValid).toBe(false);
    expect(out.errors).toContain('Product Code is required');
  });

  it('refuses an unknown product type instead of importing nothing quietly', () => {
    const out = validateRow('not-a-type', { 'Product Code': 'X' });
    expect(out.isValid).toBe(false);
    expect(out.errors[0]).toContain('Unknown product type');
  });
});

describe('the CSV parser', () => {
  it('handles quoted fields with commas and doubled quotes', () => {
    const rows = parseCsv('a,b\n"x, y","he said ""hi"""');
    expect(rows).toEqual([{ a: 'x, y', b: 'he said "hi"' }]);
  });

  it('handles CRLF and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });

  it('handles a newline inside a quoted field', () => {
    expect(parseCsv('a,b\n"line1\nline2",2')).toEqual([{ a: 'line1\nline2', b: '2' }]);
  });

  it('tolerates the UTF-8 BOM Excel writes', () => {
    // Otherwise the first header carries the BOM and every row fails
    // "Product Code is required" for a file that looks perfect in Excel.
    // What handles it is the header trim, not a separate strip: String.trim()
    // removes U+FEFF.
    const rows = parseCsv('﻿Product Code,Product Name\nPM-1,X');
    expect(rows[0]['Product Code']).toBe('PM-1');
    expect(validateRow('product-models', rows[0]).isValid).toBe(true);
  });

  it('returns nothing for an empty file or a header-only file', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('a,b\n')).toEqual([]);
  });

  it('pads a short row rather than dropping the columns', () => {
    expect(parseCsv('a,b,c\n1,2')).toEqual([{ a: '1', b: '2', c: '' }]);
  });
});

describe('the two copies agree', () => {
  it('on every spec', () => {
    expect(edge.CATALOG_IMPORT_SPECS).toEqual(CATALOG_IMPORT_SPECS);
  });

  it('on parsing and validation', () => {
    const csv = buildCsvTemplate('product-models');
    expect(edge.parseCsv(csv)).toEqual(parseCsv(csv));
    const row = parseCsv(csv)[0];
    expect(edge.validateRow('product-models', row)).toEqual(validateRow('product-models', row));
  });
});
