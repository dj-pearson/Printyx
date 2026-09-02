/**
 * check:declared-cols — a column the database has must be in the schema
 * (AUDIT-037).
 *
 * The inverse of check:phantom-cols. That one catches code naming a column the
 * table lacks; this one catches a column the table HAS that no pgTable
 * declares.
 *
 * The reason it earns a guard is that it produced a false accusation. Eight
 * "phantom" references on `proposals` were nothing of the kind - the columns had
 * been added by four hand-written migrations and none came back to
 * shared/schema.ts, so every tool that reads the declaration reported correct
 * code as broken. A guard that reports defects it caused is worse than no guard.
 *
 * There is no DROP risk and the header says so: a column never in the
 * declaration was never in the snapshot either, so db:generate does not know to
 * remove it. The cost is blindness, not danger, and overstating it would be its
 * own kind of wrong.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const guard = read('scripts/check-declared-columns.mts');

describe('the guard runs clean and is wired in', () => {
  it('passes, having replayed the whole journal', () => {
    const out = execFileSync('npx', ['tsx', join(repo, 'scripts/check-declared-columns.mts')], {
      encoding: 'utf8',
      cwd: repo,
    });
    expect(out).toMatch(/Every column the migrations create is declared/);
    expect(out).toMatch(/table\(s\) replayed/);
  });

  it('is a package script and a CI step', () => {
    expect(read('package.json')).toMatch(/"check:declared-cols"/);
    expect(read('.github/workflows/ci.yml')).toMatch(/npm run check:declared-cols/);
  });
});

describe('it reads the database by replaying, not by connecting', () => {
  it('walks the journal in order and follows ADD and DROP', () => {
    // Same technique as check:tenant-id-types and check:fk-id-types, so it runs
    // in CI with no credentials.
    expect(guard).toMatch(/_journal\.json/);
    expect(guard).toMatch(/ADD COLUMN \(\?:IF NOT EXISTS \)\?/);
    expect(guard).toMatch(/DROP COLUMN \(\?:IF EXISTS \)\?/);
  });

  it('skips a table with no Drizzle declaration at all', () => {
    // That is check:phantom-cols' story, and reporting it here would duplicate
    // a hundred known entries.
    expect(guard).toMatch(/if \(!decl\) continue;/);
  });

  it('states the consequence accurately, including what it is not', () => {
    expect(guard).toMatch(/There is no DROP risk/);
    expect(guard).toMatch(/The cost is BLINDNESS/);
  });
});

describe('the drift it was written for is gone', () => {
  it('declares the proposals columns four migrations added', () => {
    const at = read('shared/schema.ts').indexOf('export const proposals = pgTable(');
    const decl = read('shared/schema.ts').slice(at, at + 6000);
    for (const col of ['total_dealer_cost', 'share_token', 'discount_reason']) {
      expect(decl, col).toContain(`'${col}'`);
    }
  });

  it('declares proposal_templates.template_content', () => {
    const at = read('shared/schema.ts').indexOf('export const proposalTemplates = pgTable(');
    expect(read('shared/schema.ts').slice(at, at + 3000)).toContain("'template_content'");
  });
});
