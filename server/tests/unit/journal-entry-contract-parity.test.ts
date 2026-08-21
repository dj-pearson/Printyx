// PROD-008: lock the journal-entry contract to the Express zod schema.
//
// The rules existed twice and disagreed, which is the whole reason this domain
// was both-divergent: Express validated header totals and required them to
// balance, while the edge function - the copy production runs - summed a
// `lineItems` array the frontend never sends, so every entry created in prod was
// written with total_debit = 0 and total_credit = 0.
//
// The shared module is now the one implementation. These tests re-declare the
// Express schema verbatim and assert the two agree field by field over a fixture
// matrix, so a change to either side that is not made on both fails here rather
// than in production accounting data.
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  parseJournalEntry,
  parseJournalEntryPatch,
  toJournalEntryColumns,
  isBalanced,
} from '../../../supabase/functions/_shared/journal-entry-contract';

// Verbatim from server/routes-financial.ts (PA-045).
const journalEntryFields = z.object({
  entryNumber: z.string().min(1, 'Entry number is required'),
  description: z.string().min(1, 'Description is required'),
  entryDate: z.string().min(1, 'Entry date is required'),
  reference: z.string().optional(),
  totalDebit: z.coerce.number().min(0),
  totalCredit: z.coerce.number().min(0),
  status: z.string().default('draft'),
});
const journalEntryInput = journalEntryFields.refine(
  (d) => Math.abs(d.totalDebit - d.totalCredit) < 0.005,
  { message: 'Total debits must equal total credits', path: ['totalCredit'] },
);

const valid = {
  entryNumber: 'JE-001',
  description: 'Opening balance',
  entryDate: '2026-07-23',
  totalDebit: 100,
  totalCredit: 100,
};

const FIXTURES: Array<[string, unknown]> = [
  ['balanced minimum', valid],
  ['with reference and status', { ...valid, reference: 'INV-9', status: 'posted' }],
  ['zero totals', { ...valid, totalDebit: 0, totalCredit: 0 }],
  ['numeric strings', { ...valid, totalDebit: '250.50', totalCredit: '250.50' }],
  ['unbalanced', { ...valid, totalCredit: 90 }],
  ['off by a third of a cent (still balanced)', { ...valid, totalCredit: 100.003 }],
  ['off by a full cent', { ...valid, totalCredit: 100.01 }],
  ['empty entry number', { ...valid, entryNumber: '' }],
  ['empty description', { ...valid, description: '' }],
  ['empty entry date', { ...valid, entryDate: '' }],
  [
    'missing entry number',
    { description: 'x', entryDate: '2026-01-01', totalDebit: 1, totalCredit: 1 },
  ],
  ['missing totals', { entryNumber: 'JE-2', description: 'x', entryDate: '2026-01-01' }],
  ['negative debit', { ...valid, totalDebit: -1, totalCredit: -1 }],
  ['non-numeric total', { ...valid, totalDebit: 'abc' }],
  ['null total', { ...valid, totalDebit: null, totalCredit: 0 }],
  ['empty-string total', { ...valid, totalDebit: '', totalCredit: 0 }],
  ['numeric entry number', { ...valid, entryNumber: 12 }],
  ['array body', []],
  ['null body', null],
  ['empty body', {}],
];

describe('parseJournalEntry agrees with the Express zod schema', () => {
  for (const [name, body] of FIXTURES) {
    it(`accept/reject matches: ${name}`, () => {
      const zodResult = journalEntryInput.safeParse(body);
      const ours = parseJournalEntry(body);
      expect(ours.ok, `${name}: zod ${zodResult.success ? 'accepted' : 'rejected'}`).toBe(
        zodResult.success,
      );
    });

    it(`accepted values match: ${name}`, () => {
      const zodResult = journalEntryInput.safeParse(body);
      const ours = parseJournalEntry(body);
      if (!zodResult.success || !ours.ok) return;
      expect(ours.value).toEqual(zodResult.data);
    });

    it(`rejected fields match: ${name}`, () => {
      const zodResult = journalEntryInput.safeParse(body);
      const ours = parseJournalEntry(body);
      if (zodResult.success || ours.ok) return;
      // Only the SET of failing fields has to agree - the messages are zod's
      // and are not part of the contract the frontend reads.
      expect(Object.keys(ours.errors).sort()).toEqual(
        Object.keys(zodResult.error.flatten().fieldErrors).sort(),
      );
      // A whole-body complaint must stay whole-body on both sides: zod reports
      // it with an EMPTY fieldErrors, and Express puts only fieldErrors on the
      // wire, so inventing per-field errors here would change the response.
      if (zodResult.error.flatten().formErrors.length > 0) {
        expect(ours.errors).toEqual({});
        expect(ours.formErrors?.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('parseJournalEntryPatch agrees with the partial schema', () => {
  const PATCHES: Array<[string, unknown]> = [
    ['empty patch', {}],
    ['status only', { status: 'posted' }],
    ['totals only', { totalDebit: 5, totalCredit: 5 }],
    // Express applies .partial() to the FIELDS schema, which drops the refine,
    // so an unbalanced patch is accepted. Asserted so nobody "fixes" one side.
    ['unbalanced totals', { totalDebit: 5, totalCredit: 9 }],
    ['blank description', { description: '' }],
    ['negative total', { totalDebit: -3 }],
    ['string total', { totalDebit: '42' }],
    ['unknown key', { nope: 1 }],
  ];

  for (const [name, body] of PATCHES) {
    it(`matches: ${name}`, () => {
      const zodResult = journalEntryFields.partial().safeParse(body);
      const ours = parseJournalEntryPatch(body);
      expect(ours.ok).toBe(zodResult.success);
      if (zodResult.success && ours.ok) {
        // zod strips unknown keys; so does ours.
        expect(ours.value).toEqual(zodResult.data);
      }
    });
  }
});

describe('isBalanced', () => {
  it('uses a half-cent tolerance, not exact equality', () => {
    expect(isBalanced(100, 100)).toBe(true);
    expect(isBalanced(100, 100.004)).toBe(true);
    expect(isBalanced(100, 100.01)).toBe(false);
    expect(isBalanced(100, 99.99)).toBe(false);
    expect(isBalanced(0, 0)).toBe(true);
  });

  it('inherits float behaviour at the boundary, and that is deliberate', () => {
    // Math.abs(100 - 100.005) is 0.004999999999990905, so the exact boundary
    // reads as balanced. Asserted rather than papered over: the rule is
    // Express's `< 0.005` verbatim, and rounding it here would put the two
    // implementations back out of step on the one case that matters.
    expect(Math.abs(100 - 100.005) < 0.005).toBe(true);
    expect(isBalanced(100, 100.005)).toBe(true);
  });
});

describe('toJournalEntryColumns', () => {
  it('maps only real journal_entries columns', () => {
    expect(
      toJournalEntryColumns({
        entryNumber: 'JE-1',
        description: 'd',
        entryDate: '2026-01-01',
        reference: 'r',
        status: 'draft',
        totalDebit: 12.5,
        totalCredit: 12.5,
      }),
    ).toEqual({
      entry_number: 'JE-1',
      description: 'd',
      entry_date: '2026-01-01',
      reference: 'r',
      status: 'draft',
      total_debit: '12.5',
      total_credit: '12.5',
    });
  });

  it('omits absent fields so a PATCH never blanks a column it did not name', () => {
    expect(toJournalEntryColumns({ status: 'posted' })).toEqual({ status: 'posted' });
  });

  it('sends numeric columns as strings, the way Express does', () => {
    const row = toJournalEntryColumns({ totalDebit: 100, totalCredit: 100 });
    expect(row.total_debit).toBe('100');
    expect(typeof row.total_credit).toBe('string');
  });
});
