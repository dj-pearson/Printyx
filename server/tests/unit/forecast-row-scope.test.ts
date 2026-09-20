/**
 * The forecast stops showing every rep the whole team's commit (COP-I06 AC3).
 *
 * `pipeline-forecast` filtered on `tenant_id` and nothing else, so every caller
 * got every deal in the tenant - and the Categories tab turns that into a
 * per-owner commit list, which is each rep's forecast number beside their name.
 * COP-I06's own notes recorded it: "it returns every owner in the tenant, so a
 * rep opening the Categories tab sees the whole team's commit".
 *
 * The nav entry is `minLevel: 3`, which is why this looked contained. IT IS NOT
 * A CONTROL. `navigation-permissions.ts` decides what appears in a menu; the
 * function had no role check at all, so any authenticated member of the tenant
 * could request it directly. `docs/edge-rbac-baseline.json` had it in
 * `openToAllRoles` the whole time, which is exactly what that list is for.
 *
 * Rows are narrowed rather than the request refused: a rep has a forecast and
 * should see it. What changes is whose deals are in it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const FN = read('supabase/functions/pipeline-forecast/index.ts');
/** Comments blanked: this file and the handler both discuss the old behaviour. */
const CODE = FN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('every owned query is narrowed to the caller', () => {
  it('resolves the scope once, from the claim and not from a query param alone', () => {
    expect(CODE).toContain('await resolveScope(admin, {');
    expect(CODE).toContain('appMetadata: user.app_metadata');
    // ?scope= can only NARROW what the level grants - resolveScope clamps it.
    expect(CODE).toContain("requestedScope: url.searchParams.get('scope')");
  });

  /**
   * EVERY read, checked individually. The first version of this counted
   * `applyUserScope(` calls and required at least as many as there were deal
   * reads - and a mutant that unscoped the categories query, which IS the
   * defect this story is about, SURVIVED it, because the other calls kept the
   * count up. A total is not a property.
   */
  it('every owned read is wrapped, not merely outnumbered by wrappers', () => {
    const OWNED = ['deals', 'quotes', 'proposals', 'forecast_snapshots'];
    const unscoped: string[] = [];
    for (const table of OWNED) {
      for (const m of CODE.matchAll(new RegExp(`\\.from\\('${table}'\\)`, 'g'))) {
        // An insert is a write, not a read, and carries tenant_id in its
        // payload instead (SEC-TENANT-005). Only reads leak rows.
        const after = CODE.slice(m.index ?? 0, (m.index ?? 0) + 200);
        if (/^\s*\.from\([^)]*\)\s*\.insert\(/.test(after)) continue;
        // The wrapper opens immediately before `admin.from(...)`.
        const before = CODE.slice(Math.max(0, (m.index ?? 0) - 80), m.index ?? 0);
        if (!before.includes('applyUserScope(')) {
          const line = CODE.slice(0, m.index ?? 0).split('\n').length;
          unscoped.push(`${table} at line ${line}`);
        }
      }
    }
    expect(unscoped).toEqual([]);
  });

  it('there really are several owned reads, so the walk is not vacuous', () => {
    const reads = [...CODE.matchAll(/\.from\('(deals|quotes|proposals|forecast_snapshots)'\)/g)];
    expect(reads.length).toBeGreaterThanOrEqual(6);
  });

  it('scopes each table on the column it actually has', () => {
    // quotes carries created_by only; proposals adds assigned_to; deals own
    // owner_id. Scoping a table on a column it does not have would filter
    // nothing and read as protected.
    expect(CODE).toContain("['owner_id', 'created_by_id']");
    expect(CODE).toContain("'created_by',");
    expect(CODE).toContain("['assigned_to', 'created_by']");
    // A snapshot's owner_id is who it was taken FOR; captured_by is who took it.
    expect(CODE).toContain("['owner_id', 'captured_by']");
  });

  it('is recorded as row-scoped rather than ungated', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    expect(baseline.rowScoped).toContain('pipeline-forecast');
    expect(baseline.openToAllRoles).not.toContain('pipeline-forecast');
  });
});

describe('a narrowed total says it was narrowed', () => {
  it('every read branch returns the scope it applied', () => {
    // A roll-up that has been narrowed and does not say so is a wrong number,
    // not a safe one - and it sits beside a territory breakdown that would then
    // not add up to it.
    expect(CODE.match(/scope: describeScope\(scope\)/g) ?? []).toHaveLength(4);
  });

  it('the note distinguishes a real tier from a degraded one', () => {
    // resolveScope falls back to a NARROWER tier when the org structure cannot
    // answer a wider one. A manager seeing less than they should deserves to
    // know why rather than concluding the pipeline is empty.
    const fn = CODE.slice(CODE.indexOf('function describeScope'));
    expect(fn.slice(0, 1200)).toContain('degradedFrom');
    expect(fn.slice(0, 1200)).toContain('coversWholeTenant');
  });

  it('names the goals caveat, because sales_goals has no owner', () => {
    // A rep's scoped pipeline measured against a company-wide target would
    // otherwise render as a personal shortfall in `remaining`.
    expect(CODE).toContain('scopeCaveat');
    const idx = CODE.indexOf('scopeCaveat');
    expect(CODE.slice(idx, idx + 400)).toContain('isUnscoped(scope)');
  });

  it('a whole-tenant caller gets a null note, not a reassuring sentence', () => {
    const fn = CODE.slice(CODE.indexOf('function describeScope'));
    expect(fn.slice(0, 1200)).toMatch(/isUnscoped\(scope\)\s*\n?\s*\?\s*null/);
  });
});

/**
 * COP-I06 AC3's territory half was computed and never displayed.
 *
 * `/pipeline-forecast/categories` has sent `byTerritory` since COP-B09 landed
 * the territory model - a roll-up with an explicit Unassigned bucket and a
 * `territoryNote` explaining an empty one. Nothing in any client tree read
 * either key, and the panel's own footnote still told the reader that territory
 * roll-up "is not built yet". A stale disclaimer is worse than a missing
 * feature: it stops anyone looking for the thing that is already there.
 */
describe('COP-I06 AC3: the territory roll-up reaches the screen', () => {
  const PANEL = readFileSync(
    join(__dirname, '../../../client/src/components/forecast/ForecastCategoryPanel.tsx'),
    'utf8',
  );
  const FN = readFileSync(
    join(__dirname, '../../../supabase/functions/pipeline-forecast/index.ts'),
    'utf8',
  );

  it('has a corpus to check', () => {
    expect(PANEL).toContain('CategoriesResponse');
    expect(FN).toContain('byTerritory');
  });

  it('the panel reads both keys the endpoint sends', () => {
    // PA-040: a page and its endpoint agreeing on key names is the thing
    // nothing else here checks.
    // Bound to the RESPONSE PAYLOAD, not the file: `byTerritory` is also a
    // local in that function, so a file-wide check stays green when the key is
    // dropped from what is actually sent. Third time this session that a
    // presence check needed narrowing to its site.
    const payloadAt = FN.lastIndexOf('return createCorsResponse(');
    expect(payloadAt).toBeGreaterThan(-1);
    const payload = FN.slice(payloadAt);
    for (const key of ['byTerritory', 'territoryNote']) {
      expect({ key, sent: new RegExp(`^\\s*${key}[,:]`, 'm').test(payload) }).toEqual({
        key,
        sent: true,
      });
      expect({ key, read: PANEL.includes(`data.${key}`) }).toEqual({ key, read: true });
    }
  });

  it('renders the note rather than an empty table when there are no rows', () => {
    expect(PANEL).toMatch(/data\.byTerritory\.length === 0 \?/);
    expect(PANEL).toContain('{data.territoryNote}');
  });

  it('no longer claims the roll-up is unbuilt', () => {
    expect(PANEL).not.toContain('not built yet — it is absent here');
    expect(PANEL).not.toMatch(/territory roll-up needs the territory model/);
  });

  it('keeps the team gap stated, because that one is real', () => {
    // The edge function's own comment says the team roll-up still needs a
    // reporting hierarchy no story has built.
    expect(PANEL).toMatch(/Team roll-up needs a reporting hierarchy/);
    // Newline-tolerant: the comment wraps, and an assertion that assumes one
    // line reports a correct file as wrong.
    expect(FN.replace(/\s*\n\s*\/\/\s*/g, ' ')).toMatch(
      /TEAM roll-up still needs a reporting hierarchy/,
    );
  });

  it('keeps the Unassigned bucket visible', () => {
    // Omitting unmatched accounts is how a grouped view stops adding up to the
    // totals beside it (COP-B10).
    expect(PANEL).toMatch(/Unassigned/);
    expect(FN).toContain('rollupByTerritory');
  });
});

/**
 * COP-B09 AC5: a territory quota nobody could set and nothing read.
 *
 * `sales_territories.monthly_quota` has existed all along. The only writer was
 * `lead-assignment/handlers/territories.ts`, which no reachable surface calls,
 * and no reader existed anywhere - so the column was AUDIT-028's shape from the
 * other end: a number a user can store and never see.
 *
 * It is settable on the territory page now and the forecast's territory roll-up
 * reports commit against it. The assertions that matter are about NULL: a
 * territory with no target has not missed one.
 */
describe('COP-B09 AC5: territory quota and attainment', () => {
  const TERRITORIES_FN = readFileSync(
    join(__dirname, '../../../supabase/functions/sales-territories/index.ts'),
    'utf8',
  );
  const FORECAST_FN = readFileSync(
    join(__dirname, '../../../supabase/functions/pipeline-forecast/index.ts'),
    'utf8',
  );
  const PAGE = readFileSync(
    join(__dirname, '../../../client/src/pages/SalesTerritories.tsx'),
    'utf8',
  );
  const PANEL = readFileSync(
    join(__dirname, '../../../client/src/components/forecast/ForecastCategoryPanel.tsx'),
    'utf8',
  );

  it('is settable: create, partial update, and returned on reads', () => {
    expect(TERRITORIES_FN).toMatch(/monthly_quota: body\.monthlyQuota/);
    expect(TERRITORIES_FN).toMatch(/set\('monthly_quota', body\.monthlyQuota/);
    // Returned, or the page cannot show what it just saved.
    expect(TERRITORIES_FN).toMatch(/manager_id, monthly_quota,/);
  });

  it('the page sends null for an empty field, never 0', () => {
    // 0 is a target of nothing, which makes every territory 100% attained.
    expect(PAGE).toMatch(
      /form\.monthlyQuota\.trim\(\) === '' \? null : Number\(form\.monthlyQuota\)/,
    );
  });

  it('the forecast fetches the quota and reports attainment against it', () => {
    expect(FORECAST_FN).toMatch(/is_active, monthly_quota'/);
    expect(FORECAST_FN).toContain('attainmentPercent');
  });

  it('attainment is null without a quota, not zero and not a division by zero', () => {
    const at = FORECAST_FN.indexOf('attainmentPercent:');
    expect(at).toBeGreaterThan(-1);
    const expr = FORECAST_FN.slice(at, at + 260);
    expect(expr).toMatch(/> 0/);
    expect(expr).toMatch(/: null/);
  });

  it('the panel renders an em dash rather than a number it does not have', () => {
    expect(PANEL).toMatch(/row\.monthlyQuota == null \?/);
    expect(PANEL).toMatch(/row\.attainmentPercent == null \?/);
  });
});
