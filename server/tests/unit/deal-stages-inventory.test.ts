/**
 * COP-M07 AC1/AC2: one stage model, and an inventory that stays true.
 *
 * CRMX-005 bound the board to pipeline_stages through
 * pipeline_stages.legacy_stage_id, leaving deal_stages as the IDENTITY map:
 * deals.stage_id still holds a legacy id, and the mirror is one-way, so the
 * legacy row is the authoritative copy of name and colour. That is the accepted
 * exception. What is NOT accepted is a surface reading stage CONFIGURATION -
 * won/closing flags, forecast weighting, order - off the legacy table, because
 * that is a second source of truth for what a stage means.
 *
 * Two such readers survived until this story closed:
 *
 *   supabase/functions/pipeline/ served /stages CRUD and /stats entirely off
 *   deal_stages. It duplicated pipeline-config, which is the canonical one, and
 *   had NO CALLER in any of the seven client trees, no proxy entry and no
 *   server.ts alias - it was in docs/unreferenced-edge-fns-baseline.json. It is
 *   deleted rather than migrated: porting a dead duplicate onto the canonical
 *   table is careful work on code nothing runs.
 *
 *   supabase/functions/opportunities/ embedded is_won_stage and is_closing_stage
 *   on every deal it returned, and NOTHING READ EITHER - mapDealToOpportunity
 *   uses deal_stage?.name and nothing else. Two legacy config flags travelling
 *   into a response that never mentions them. The embed is now name and colour,
 *   which is identity.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOTS = ['client/src', 'server', 'supabase/functions', 'shared', 'scripts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'tests') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Comments explain the identity map at length; they are not reads. */
const codeOnly = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

/**
 * PRD-authoring scripts are excluded BY RULE, not baselined. They carry this
 * story's own text - "remove remaining legacy dealStages reads" - as a string,
 * and a guard that cannot tell prose from a call site reports its own
 * explanation as the defect. CLAUDE.md records that trap firing twice already.
 */
const isStoryProse = (f: string) => /^scripts\/.*(stories|prd)/.test(f);

const files = ROOTS.filter(existsSync)
  .flatMap((r) => walk(r))
  .filter((f) => !isStoryProse(f));

/**
 * Files allowed to name deal_stages IN CODE, each for a stated reason. This is
 * the AC1 inventory, and it is a test rather than a paragraph so it cannot go
 * stale the way a recorded list does.
 */
const SANCTIONED: Record<string, string> = {
  'shared/schema.ts': 'declares the legacy table',
  'server/storage.ts': 'legacy stage CRUD, which drives the mirror',
  'server/seeds/demo-data.ts': 'seeds both sides so a demo tenant resolves',
  'server/routes-universal-search.ts': 'joins the stage NAME for a search result label',
  'supabase/functions/pipeline-config/index.ts': 'the canonical surface, which owns the bridge',
  'supabase/functions/deals/index.ts': 'reads stage names for the deal list',
  'supabase/functions/proposals/index.ts': 'resolves a stage_id when acceptance creates a deal',
  'supabase/functions/opportunities/index.ts': 'embeds the stage NAME and COLOUR for iOS',
  'supabase/functions/reports/handlers/frontend-stubs.ts':
    'canonical first, legacy fallback for a tenant whose stages predate the bridge',
  'scripts/check-stage-resolution.mjs': 'the guard that proves the bridge holds',
  'scripts/verify-database-migration.mjs': 'lists the table among those a migration must create',
};

describe('COP-M07 AC1: every deal_stages reference is accounted for', () => {
  const referencing = files.filter((f) =>
    /deal_stages|dealStages/.test(codeOnly(readFileSync(f, 'utf8'))),
  );

  it('no file reads the legacy table without a recorded reason', () => {
    const unaccounted = referencing.filter((f) => !SANCTIONED[f]);
    expect(unaccounted).toEqual([]);
  });

  it('the inventory covers every code reader, and comment-only files are not in it', () => {
    // pipeline-stage-mirror.ts and _shared/deal-stage.ts explain the bridge at
    // length and name the legacy table in no code, which is why neither is
    // listed: the inventory is of READS.
    for (const f of [
      'server/lib/pipeline-stage-mirror.ts',
      'supabase/functions/_shared/deal-stage.ts',
    ]) {
      expect(referencing).not.toContain(f);
      expect(readFileSync(f, 'utf8')).toContain('deal_stages');
    }
  });

  it('the inventory has no stale entries either', () => {
    // A sanctioned file that no longer references it means the list is drifting
    // in the other direction, which is how an inventory stops being true.
    const stale = Object.keys(SANCTIONED).filter((f) => existsSync(f) && !referencing.includes(f));
    expect(stale).toEqual([]);
  });
});

describe('COP-M07 AC2: no surface reads stage CONFIG off the legacy table', () => {
  it('the dead duplicate is gone', () => {
    // Six deal_stages reads, zero callers, superseded by pipeline-config.
    expect(existsSync('supabase/functions/pipeline/index.ts')).toBe(false);
    expect(existsSync('supabase/functions/pipeline/')).toBe(false);
  });

  it('nothing but the mirror touches the legacy won/closing flags', () => {
    // pipeline-config READS them to WRITE is_closed_won / is_final_stage on the
    // canonical row. That is the mirror, and it is the one direction the bridge
    // is allowed to run: legacy is authoritative, canonical is the copy.
    const MAY_NAME_THE_FLAGS = new Set([
      // Declares the columns.
      'shared/schema.ts',
      // Reads them to WRITE is_closed_won / is_final_stage on the canonical row.
      'supabase/functions/pipeline-config/index.ts',
      'server/lib/pipeline-stage-mirror.ts',
    ]);
    for (const file of files) {
      if (MAY_NAME_THE_FLAGS.has(file)) continue;
      const code = codeOnly(readFileSync(file, 'utf8'));
      if (!/deal_stages|dealStages/.test(code)) continue;
      expect(`${file}: ${/is_won_stage|is_closing_stage/.test(code)}`).toBe(`${file}: false`);
    }
  });

  it('the mirror runs one way and only one way', () => {
    const mirror = codeOnly(readFileSync('server/lib/pipeline-stage-mirror.ts', 'utf8'));
    // It writes pipeline_stages from a legacy row. Nothing writes deal_stages
    // from a canonical one, which would make the copy authoritative in reverse.
    expect(mirror).toContain('legacyStageId: stage.id');
    expect(mirror).not.toMatch(/update\(dealStages\)/);
  });

  it('the opportunities embed is identity only', () => {
    const code = codeOnly(readFileSync('supabase/functions/opportunities/index.ts', 'utf8'));
    expect(code).toContain('deal_stage:deal_stages!stage_id(id, name, color)');
    expect(code).not.toContain('is_won_stage');
  });

  it('the canonical flags live on pipeline_stages', () => {
    const schema = readFileSync('shared/pipeline-configuration-schema.ts', 'utf8');
    for (const col of ['is_final_stage', 'is_closed_won', 'is_closed_lost']) {
      expect(schema).toContain(col);
    }
  });
});

describe('COP-M07 AC5: the bridge is provable, not asserted', () => {
  const guard = readFileSync('scripts/check-stage-resolution.mjs', 'utf8');

  it('checks orphans, ambiguity and unmirrored legacy stages', () => {
    expect(guard).toContain('legacy_stage_id = d.stage_id');
    expect(guard).toContain('having count(*) > 1');
    expect(guard).toContain('Active legacy stages with no canonical mirror');
  });

  it('exits 2 when it cannot connect, so "did not run" is never read as "passed"', () => {
    expect(guard).toContain('process.exit(2)');
  });

  it('is a runnable npm script', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['check:stage-resolution']).toContain('check-stage-resolution.mjs');
  });
});
