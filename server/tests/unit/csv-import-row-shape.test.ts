/**
 * CRMX-011a parity lock: both backends must store the SAME rows.
 *
 * /api/import is not proxied, so Express serves dev and the import edge
 * function serves production. Both write csv_import_jobs.raw_data, and they
 * disagreed: Express stored an array of objects keyed by CSV header, the edge
 * function stored an array of cell arrays and its executor indexed into them
 * positionally. A job written by one host was unreadable by the other, and the
 * edge executor's mapping lookup produced undefined for every field.
 *
 * These import both parsers and assert they agree. A change to either that the
 * other does not get fails here.
 */
import { describe, it, expect } from 'vitest';

import { parseCSVContent } from '../../services/csv-import-service';
import {
  parseCsv,
  toRowObjects,
  parseCSVLine,
  overallConfidence,
} from '../../../supabase/functions/import/_csv';

const CSV = [
  'Company Name,Billing City,Billing State,Phone',
  'Northgate Dental,Provo,UT,801-555-0100',
  '"Alvarez, Ruiz & Co.",Orem,UT,801-555-0111',
  'Cedar Ridge Print,Lehi,UT,',
  '',
  ',,,',
].join('\n');

describe('CSV row shape', () => {
  it('the two hosts parse the same file into the same rows', () => {
    const node = parseCSVContent(CSV);
    const edge = parseCsv(CSV);

    expect(edge.headers).toEqual(node.headers);
    expect(edge.rows).toEqual(node.rows);
  });

  it('rows are objects keyed by header, not arrays of cells', () => {
    const { rows } = parseCsv(CSV);
    expect(rows[0]).toEqual({
      'Company Name': 'Northgate Dental',
      'Billing City': 'Provo',
      'Billing State': 'UT',
      Phone: '801-555-0100',
    });
  });

  it('keeps a quoted comma inside one field', () => {
    expect(parseCSVLine('"Alvarez, Ruiz & Co.",Orem,UT')).toEqual([
      'Alvarez, Ruiz & Co.',
      'Orem',
      'UT',
    ]);
  });

  it('drops blank and all-empty rows', () => {
    const { rows } = parseCsv(CSV);
    expect(rows).toHaveLength(3);
  });

  // A short row must yield '' rather than undefined, because the executor
  // treats a falsy value as "column not supplied" and a mapping lookup that
  // returns undefined is indistinguishable from a missing header.
  it('pads a short row with empty strings', () => {
    const rows = toRowObjects(['a', 'b', 'c'], [['1', '2']]);
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('handles a header-only file', () => {
    expect(parseCsv('a,b,c')).toEqual({ headers: ['a', 'b', 'c'], rows: [] });
  });

  it('handles an empty file', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  it('handles CRLF line endings', () => {
    const { headers, rows } = parseCsv('a,b\r\n1,2\r\n');
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });
});

describe('overallConfidence', () => {
  it('averages across every header, mapped or not', () => {
    expect(overallConfidence([{ confidence: 100 }, { confidence: 0 }])).toBe(50);
  });

  it('is 0 for no mappings rather than NaN', () => {
    expect(overallConfidence([])).toBe(0);
  });
});
