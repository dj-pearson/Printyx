/**
 * The setMonth idiom is gone from the tree, and each fix is DEMONSTRATED with
 * arithmetic rather than asserted from memory (DATE-SETMONTH-001).
 *
 * The premise is the thing people doubt, so every case below computes both the
 * old behaviour and the new one and shows the gap. Date.setMonth overflows: ask
 * a 31 March date for month index 2 and you get "31 February", which resolves
 * to 3 March. The idiom is therefore wrong on the 29th, 30th and 31st - about
 * four days in twelve of every year - and silently right the rest of the time,
 * which is why thirty of these accumulated without one being reported.
 *
 * Same style as financial-period-months.test.ts, deliberately.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { addMonths, subtractMonths } from '../../../shared/date-months';

const repo = process.cwd();
const raw = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

/** What the old idiom did, so the tests can show it rather than claim it. */
function legacySetMonth(from: Date, delta: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + delta);
  return d;
}
const iso = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('the overflow is real, on the days it happens', () => {
  it('31 March minus one month lands in March again', () => {
    expect(iso(legacySetMonth(new Date(2025, 2, 31), -1))).toBe('2025-3-3');
    expect(iso(subtractMonths(new Date(2025, 2, 31), 1))).toBe('2025-2-28');
  });

  it('30 November plus three months skips February', () => {
    expect(iso(legacySetMonth(new Date(2025, 10, 30), 3))).toBe('2026-3-2');
    expect(iso(addMonths(new Date(2025, 10, 30), 3))).toBe('2026-2-28');
  });

  it('and is invisible on the other twenty-seven days', () => {
    for (let day = 1; day <= 28; day++) {
      const from = new Date(2025, 2, day);
      expect(iso(legacySetMonth(from, -1))).toBe(iso(subtractMonths(from, 1)));
    }
  });
});

describe('a reporting window opened on the 31st', () => {
  it('period=month covered the CURRENT month only, with February missing', () => {
    // What supabase/functions/seo and platform-deals both computed.
    const now = new Date(2025, 2, 31);
    const legacy = legacySetMonth(now, -1);
    expect(legacy.getMonth()).toBe(2); // March: the window never left it
    expect(Math.round((now.getTime() - legacy.getTime()) / 86400000)).toBe(28);

    const fixed = subtractMonths(now, 1);
    expect(fixed.getMonth()).toBe(1); // February
    expect(Math.round((now.getTime() - fixed.getTime()) / 86400000)).toBe(31);
  });

  it('a six-month satisfaction window started three months late', () => {
    const now = new Date(2025, 7, 31); // 31 August
    expect(legacySetMonth(now, -6).getMonth()).toBe(2); // March, not February
    expect(subtractMonths(now, 6).getMonth()).toBe(1);
  });
});

describe('a month series stepping a day-of-month cursor drops months', () => {
  it('six months back from 31 March yields four distinct months, not six', () => {
    const now = new Date(2025, 2, 31);
    const legacy = new Set<number>();
    for (let i = 0; i < 6; i++) legacy.add(legacySetMonth(now, -i).getMonth());
    expect(legacy.size).toBeLessThan(6);

    const fixed = new Set<number>();
    for (let i = 0; i < 6; i++) fixed.add(subtractMonths(now, i).getMonth());
    expect(fixed.size).toBe(6);
    // March back through October: Oct, Nov, Dec, Jan, Feb, Mar.
    expect([...fixed].sort((a, b) => a - b)).toEqual([0, 1, 2, 9, 10, 11]);
  });

  it('a twelve-payment schedule from 31 January covers twelve distinct months', () => {
    const start = new Date(2025, 0, 31);
    const legacyMonths = new Set<string>();
    const fixedMonths = new Set<string>();
    for (let i = 0; i < 12; i++) {
      legacyMonths.add(iso(legacySetMonth(start, i)).slice(0, 7));
      fixedMonths.add(`${addMonths(start, i).getFullYear()}-${addMonths(start, i).getMonth()}`);
    }
    expect(legacyMonths.size).toBeLessThan(12);
    expect(fixedMonths.size).toBe(12);
  });
});

describe('the last day of the current month', () => {
  it('was computed as the last day of the NEXT one, from the 31st', () => {
    // billing-engine-service's default period end: setMonth(+1) then setDate(0).
    const from = new Date(2025, 0, 31);
    const legacy = legacySetMonth(from, 1);
    legacy.setDate(0);
    expect(iso(legacy)).toBe('2025-2-28'); // last day of February

    const fixed = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    expect(iso(fixed)).toBe('2025-1-31'); // last day of January, which is what it means
  });
});

describe('the idiom is gone from the whole tree, not from a list of files', () => {
  /**
   * This named twelve files. A property asserted about one file BY NAME stops
   * being enforced the day that file is renamed or deleted - which is exactly
   * what happened when `server/seed-lease-data.ts` (an orphan with no runner
   * and no importer) was retired, and it is the same lesson
   * sql-injection-prevention.test.ts already carries. So it walks instead.
   *
   * Two exclusions, both by rule rather than by name-list:
   *   - `server/tests/` and this file, because these tests DEMONSTRATE the old
   *     idiom to show what it got wrong; asserting its absence over its own
   *     proof reports the explanation as the defect.
   *   - `shared/date-months.ts` and its Deno twin, the replacement. They step a
   *     cursor that is pinned to day 1, where setMonth cannot overflow, and
   *     that is the whole point of having one implementation.
   */
  const ROOTS = ['server', 'client/src', 'supabase/functions', 'shared', 'scripts'];
  const EXCLUDED = /(^|\/)(node_modules|dist|build)(\/|$)|(^|\/)server\/tests\/|date-months\.ts$/;
  const IDIOM = /setMonth\(\s*\w+(?:\.\w+)*\.getMonth\(\)\s*[+-]/;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(repo, dir))) {
      const rel = `${dir}/${entry}`;
      if (EXCLUDED.test(rel)) continue;
      if (statSync(join(repo, rel)).isDirectory()) walk(rel, out);
      else if (/\.(tsx?|mjs)$/.test(entry)) out.push(rel);
    }
    return out;
  }

  const files = ROOTS.flatMap((r) => walk(r));

  it('walks a corpus rather than a list, and a big one', () => {
    // A walk that matched nothing would pass every assertion below in silence,
    // which is the vacuous-pass trap check:unlinked-routes was caught by.
    expect(files.length).toBeGreaterThan(1000);
  });

  it('no production file steps a month by hand', () => {
    const offenders = files.filter((f) => IDIOM.test(code(f)));
    expect(offenders).toEqual([]);
  });
});

describe('one implementation, two entry points', () => {
  it('@shared/date-months re-exports rather than copying', () => {
    const shared = raw('shared/date-months.ts');
    expect(shared).toContain("from '../supabase/functions/_shared/date-months.ts'");
    // A copy would need a parity test to stay honest; a re-export cannot drift.
    expect(shared).not.toContain('export function');
  });
});

describe('a calendar-date bound built from an instant (DATE-LOCAL-002)', () => {
  it('excluded a contract ending today', () => {
    // contracts.end_date is stored at midnight. A gte built from `new Date()`
    // sits after that midnight, so the contract ending today is already behind
    // the lower bound - the renewals card silently lost its most urgent row.
    const endDateStoredAt = Date.UTC(2025, 4, 20, 0, 0, 0);
    const nowMidMorning = Date.UTC(2025, 4, 20, 9, 30, 0);
    expect(endDateStoredAt >= nowMidMorning).toBe(false);

    const snapped = Date.UTC(2025, 4, 20, 0, 0, 0);
    expect(endDateStoredAt >= snapped).toBe(true);
  });

  it('and the dashboard handlers snap both bounds', () => {
    const metrics = code('supabase/functions/dashboard/handlers/metrics.ts');
    expect(metrics).toContain('startOfUtcDay(now).toISOString()');
    expect(metrics).toContain('startOfNextUtcDay(horizon).toISOString()');
    for (const f of [
      'supabase/functions/dashboard/handlers/charts.ts',
      'supabase/functions/dashboard/handlers/summary.ts',
    ]) {
      expect(code(f), f).toContain('startOfUtcDay(');
    }
  });
});
