import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { journalEntryFromRow } from '@/pages/JournalEntries';

const root = resolve(__dirname, '../../..');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = strip(readFileSync(resolve(root, 'client/src/pages/JournalEntries.tsx'), 'utf8'));

describe('journal entries page (round 233)', () => {
  it('turns PostgREST numeric strings into numbers, so toFixed cannot throw', () => {
    const e = journalEntryFromRow({
      id: 'j1',
      entry_number: 'JE-1',
      entry_date: '2026-09-24',
      total_debit: '100.50',
      total_credit: '100.50',
    });
    expect(e.totalDebit).toBe(100.5);
    expect(e.totalCredit).toBe(100.5);
    expect(() => e.totalDebit.toFixed(2)).not.toThrow();
    // A zero stored as "0.00" is truthy as a string; it must still be 0.
    expect(journalEntryFromRow({ id: 'j', total_debit: '0.00' }).totalDebit).toBe(0);
    expect(journalEntryFromRow({ id: 'j', total_debit: 'junk' }).totalDebit).toBe(0);
  });

  it('types entries from the module that exports them, not @shared/schema', () => {
    expect(PAGE).toContain("from '@shared/journal-entries-schema'");
  });

  it('offers no notes field, because journal_entries has no notes column', () => {
    const schema = readFileSync(resolve(root, 'shared/journal-entries-schema.ts'), 'utf8');
    expect(schema).not.toMatch(/\bnotes\b/);
    expect(PAGE).not.toMatch(/name="notes"/);
    expect(PAGE).not.toMatch(/\bnotes:/);
  });
});
