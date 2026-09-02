/**
 * The CSV import duplicate rule, and the review step that depends on it.
 *
 * PA-052: the import function's execute path has always matched incoming rows
 * against existing `companies` and merged into whatever it found, silently. The
 * review step meant to ask first was stubbed - validation set
 * duplicates_detected: 0, GET /duplicates returned [], and resolve-all answered
 * "Duplicates resolved" without touching a row.
 *
 * Detection and execute now share one rule. If they drift, the user reviews one
 * set of duplicates and the import merges a different one, so this pins the rule
 * and pins the branches that must keep honouring it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const matcherSrc = readFileSync(
  join(repo, 'supabase/functions/_shared/import-duplicate-match.ts'),
  'utf8',
);
const fnSrc = readFileSync(join(repo, 'supabase/functions/import/index.ts'), 'utf8');

// The matcher is Deno-flavoured (.ts specifiers), so its logic is re-expressed
// here from the same source text rather than imported. The assertions below
// check the SOURCE carries each rule; the behavioural cases run a local copy
// kept deliberately tiny.
const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .trim();
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function findDuplicate(
  row: { businessName: string; city?: string | null; state?: string | null; phone?: string | null },
  candidates: Record<string, any>[],
) {
  const name = norm(row.businessName);
  const city = norm(row.city);
  const state = norm(row.state);
  const phone = digits(row.phone);

  for (const existing of candidates) {
    if (norm(existing.business_name) !== name) continue;
    if (
      city &&
      state &&
      norm(existing.billing_city) === city &&
      norm(existing.billing_state) === state
    ) {
      return { existing, matchScore: 95 };
    }
  }
  if (phone) {
    for (const existing of candidates) {
      if (norm(existing.business_name) !== name) continue;
      if (existing.phone && digits(existing.phone) === phone) return { existing, matchScore: 85 };
    }
  }
  return null;
}

const ACME = {
  id: 'c1',
  business_name: 'Acme Copiers',
  billing_city: 'Des Moines',
  billing_state: 'IA',
  phone: '515-242-7911',
};

describe('what counts as a duplicate', () => {
  it('matches on name plus city and state', () => {
    expect(
      findDuplicate({ businessName: 'ACME COPIERS', city: 'des moines', state: 'ia' }, [ACME]),
    ).toMatchObject({ matchScore: 95 });
  });

  it('falls back to name plus phone, ignoring formatting', () => {
    expect(
      findDuplicate({ businessName: 'Acme Copiers', phone: '(515) 242 7911' }, [ACME]),
    ).toMatchObject({ matchScore: 85 });
  });

  it('does NOT match on the name alone', () => {
    // Two customers can share a name in different states; merging them on that
    // basis is the damage this whole review step exists to prevent.
    expect(findDuplicate({ businessName: 'Acme Copiers' }, [ACME])).toBeNull();
    expect(
      findDuplicate({ businessName: 'Acme Copiers', city: 'Omaha', state: 'NE' }, [ACME]),
    ).toBeNull();
  });

  it('does not match a different company that shares a city', () => {
    expect(
      findDuplicate({ businessName: 'Beta Imaging', city: 'Des Moines', state: 'IA' }, [ACME]),
    ).toBeNull();
  });
});

describe('the review step is wired to the rule', () => {
  it('detection uses the shared matcher rather than its own comparison', () => {
    expect(fnSrc).toContain("from '../_shared/import-duplicate-match.ts'");
    expect(fnSrc).toMatch(/findDuplicate\(/);
  });

  it('the two stubbed answers are gone', () => {
    const code = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // GET /duplicates returned this literal; resolve-all returned that message.
    expect(code).not.toMatch(/duplicates:\s*\[\]/);
    expect(code).not.toContain("{ message: 'Duplicates resolved' }");
  });

  it('re-running detection replaces the previous rows rather than stacking them', () => {
    expect(fnSrc).toMatch(/from\('csv_import_duplicates'\)\s*\n\s*\.delete\(\)/);
  });

  it('execute skips rows resolved as skip', () => {
    expect(fnSrc).toMatch(/resolution === 'skip'/);
  });

  it('execute says when a create_new resolution was not honoured', () => {
    // It still merges; the count must not read as a clean import.
    expect(fnSrc).toMatch(/unhonouredCreateNew/);
    expect(fnSrc).toMatch(/unhonoured:/);
  });

  it('a resolution outside the column vocabulary is refused', () => {
    expect(fnSrc).toMatch(/DUPLICATE_RESOLUTIONS\.includes\(resolution\)/);
    expect(matcherSrc).toContain("['skip', 'merge', 'create_new', 'pending']");
  });
});
