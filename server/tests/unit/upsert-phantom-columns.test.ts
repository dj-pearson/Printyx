/**
 * The verb a settings row is written with, and the four write paths that hid
 * behind it (round 125).
 *
 * check:phantom-cols is a hard gate at zero and it did not match `.upsert(`.
 * A settings row is written with "create it or change it" by nature, so the
 * one verb outside the gate's scope was the one every policy row used: 58
 * .upsert( calls in the edge tree were unchecked, and adding the verb
 * reported 17 phantom columns across three files, each a guaranteed PGRST204
 * the moment its branch runs.
 *
 * The sharpest of them is not a broken form. `manufacturer-integrations`
 * upserted seven credential columns the table has never had, and
 * SEC-EDGE-001 round 74 copied those seven names into a REDACTOR - so the
 * redaction deleted nothing, added no marker, and every dealer API key kept
 * leaving the function in plain text. A phantom write taught a security
 * control which columns to hide.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { companyPricingSettings } from '@shared/product-pricing-schema';
import { manufacturerIntegrations } from '@shared/manufacturer-integration-schema';
import {
  COMPANY_PRICING_SETTINGS_FIELDS,
  COMPANY_PRICING_SETTINGS_READONLY_FIELDS,
  buildCompanyPricingSettingsUpdate,
  toCompanyPricingSettings,
} from '@shared/company-pricing-settings';
import {
  MANUFACTURER_INTEGRATION_VIEW_FIELDS,
  REDACTED_COLUMNS,
  buildManufacturerConnect,
  toManufacturerIntegrationView,
  toManufacturerIntegrationViews,
} from '@shared/manufacturer-integration-view';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
/** Absence and ordering assertions read the source with comments removed. */
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const columnsOf = (table: unknown) =>
  new Set(getTableConfig(table as never).columns.map((c) => c.name));

describe('check:phantom-cols sees .upsert()', () => {
  const GUARD = read('scripts/check-phantom-columns.ts');

  it('covers upsert in both the inline-literal and named-variable scans', () => {
    // Bound to the two call-site patterns rather than counting the word, since
    // `upsert` also appears in the header explaining why it was added.
    const code = stripComments(GUARD);
    expect(code).toMatch(/matchAll\(\/\\\.\(insert\|update\|upsert\)\\\(\\s\*\\\{\/g\)/);
    expect(code).toMatch(
      /matchAll\(\/\\\.\(insert\|update\|upsert\)\\\(\\s\*\(\[A-Za-z_\$\]\[\\w\$\]\*\)\\s\*\[,\)\]\/g\)/,
    );
  });

  it('the baseline is still empty, so this is a gate and not a ratchet', () => {
    const baseline = JSON.parse(read('docs/phantom-columns-baseline.json'));
    expect(Object.keys(baseline).sort()).toEqual(['allowed', 'note']);
    expect(baseline.allowed).toEqual([]);
  });
});

describe('manufacturer integration view', () => {
  const columns = columnsOf(manufacturerIntegrations);

  it('the seven columns the old redactor named are not columns', () => {
    // This is why it redacted nothing. Kept as an assertion so that a
    // migration adding one of them forces a re-read of the view.
    for (const phantom of [
      'api_key',
      'api_secret',
      'client_id',
      'client_secret',
      'access_token',
      'refresh_token',
      'webhook_secret',
    ]) {
      expect({ phantom, exists: columns.has(phantom) }).toEqual({ phantom, exists: false });
    }
  });

  it('every field the view publishes is a real column', () => {
    for (const [field, column] of Object.entries(MANUFACTURER_INTEGRATION_VIEW_FIELDS)) {
      expect({ field, column, real: columns.has(column) }).toEqual({ field, column, real: true });
    }
  });

  it('the allow-list omits every redacted column', () => {
    const published = new Set(Object.values(MANUFACTURER_INTEGRATION_VIEW_FIELDS));
    for (const column of REDACTED_COLUMNS) {
      expect({ column, published: published.has(column) }).toEqual({ column, published: false });
    }
  });

  it('a credential value never leaves, under either spelling', () => {
    const row = {
      id: 'i1',
      manufacturer: 'hp',
      integration_name: 'HP Smart',
      credentials: { apiKey: 'sk-live-SECRET', clientSecret: 'cs-SECRET', password: 'hunter2' },
      configuration: { region: 'us' },
    };
    const view = toManufacturerIntegrationView(row)!;
    const serialised = JSON.stringify(view);
    for (const secret of ['sk-live-SECRET', 'cs-SECRET', 'hunter2']) {
      expect({ secret, leaked: serialised.includes(secret) }).toEqual({ secret, leaked: false });
    }
    expect(view.credentialKeys).toEqual(['apiKey', 'clientSecret', 'password']);
    expect(view.credentialsSet).toBe(true);
    expect(view.credentials).toBeUndefined();
  });

  it('a column nobody allow-listed does not leave either', () => {
    // The whole point of rule 1: the next migration cannot publish a secret
    // by adding a column this module has never heard of.
    const view = toManufacturerIntegrationView({
      id: 'i1',
      some_future_secret: 'oops',
      credentials: {},
    })!;
    expect(JSON.stringify(view).includes('oops')).toBe(false);
  });

  it('camelises, because the page reads camelCase and prod answered snake', () => {
    const view = toManufacturerIntegrationView({
      integration_name: 'Canon eMaintenance',
      auth_method: 'oauth2',
      api_endpoint: 'https://example.test',
      collection_frequency: 'daily',
      is_active: true,
      credentials: { apiKey: 'x' },
    })!;
    expect(view.integrationName).toBe('Canon eMaintenance');
    expect(view.authMethod).toBe('oauth2');
    expect(view.apiEndpoint).toBe('https://example.test');
    expect(view.collectionFrequency).toBe('daily');
    expect(view.isActive).toBe(true);
  });

  it('accepts a Drizzle row too, since Express serves this prefix in dev', () => {
    const view = toManufacturerIntegrationView({
      integrationName: 'Xerox',
      authMethod: 'api_key',
      isActive: false,
      credentials: { apiKey: 'sk-SECRET' },
    })!;
    expect(view.integrationName).toBe('Xerox');
    expect(view.isActive).toBe(false);
    expect(JSON.stringify(view).includes('sk-SECRET')).toBe(false);
  });

  it('an empty credential value is not a configured credential', () => {
    const view = toManufacturerIntegrationView({
      id: 'i',
      credentials: { apiKey: '', token: null },
    })!;
    expect(view.credentialKeys).toEqual([]);
    expect(view.credentialsSet).toBe(false);
  });

  it('a null row is null, not an object of undefineds', () => {
    expect(toManufacturerIntegrationView(null)).toBeNull();
    expect(toManufacturerIntegrationViews(null)).toEqual([]);
  });
});

describe('manufacturer connect plan', () => {
  const columns = columnsOf(manufacturerIntegrations);
  const NOT_NULL = getTableConfig(manufacturerIntegrations as never)
    .columns.filter((c) => c.notNull && !c.hasDefault)
    .map((c) => c.name);

  it('writes only real columns', () => {
    const plan = buildManufacturerConnect('hp', { apiKey: 'k' }, 't1');
    expect(plan.error).toBeUndefined();
    for (const column of Object.keys(plan.row)) {
      expect({ column, real: columns.has(column) }).toEqual({ column, real: true });
    }
  });

  it('supplies every NOT NULL column that has no default', () => {
    // Derived, so a migration adding one fails here rather than at runtime.
    const plan = buildManufacturerConnect('hp', { apiKey: 'k' }, 't1');
    for (const column of NOT_NULL) {
      expect({ column, supplied: column in plan.row }).toEqual({ column, supplied: true });
    }
    expect(NOT_NULL.length).toBeGreaterThan(2);
  });

  it('puts the secrets in the credentials blob under the keys the adapter reads', () => {
    const plan = buildManufacturerConnect(
      'canon',
      { clientId: 'ci', client_secret: 'cs', accessToken: 'at' },
      't1',
    );
    expect(plan.row.credentials).toEqual({ clientId: 'ci', clientSecret: 'cs', accessToken: 'at' });
    const adapters = read('supabase/functions/_shared/manufacturer-adapters.ts');
    for (const key of ['clientId', 'clientSecret', 'accessToken', 'apiKey']) {
      expect({ key, read: adapters.includes(`credentials.${key}`) }).toEqual({ key, read: true });
    }
  });

  it('refuses an unknown manufacturer rather than sending it to a pgEnum', () => {
    const plan = buildManufacturerConnect('brother', { apiKey: 'k' }, 't1');
    expect(plan.error).toMatch(/Unknown manufacturer/);
    expect(plan.row).toEqual({});
  });

  it('refuses a request with no credentials rather than storing an empty blob', () => {
    const plan = buildManufacturerConnect('hp', { integrationName: 'HP' }, 't1');
    expect(plan.error).toMatch(/No credentials/);
  });

  it('derives the auth method, preferring oauth over a key that is also present', () => {
    expect(buildManufacturerConnect('hp', { apiKey: 'k' }, 't').row.auth_method).toBe('api_key');
    expect(
      buildManufacturerConnect('hp', { clientId: 'c', clientSecret: 's', apiKey: 'k' }, 't').row
        .auth_method,
    ).toBe('oauth2');
    expect(
      buildManufacturerConnect('hp', { username: 'u', password: 'p' }, 't').row.auth_method,
    ).toBe('basic_auth');
    expect(
      buildManufacturerConnect('hp', { authMethod: 'hmac', apiKey: 'k' }, 't').row.auth_method,
    ).toBe('hmac');
  });

  it('refuses a declared auth method that is not in the enum', () => {
    // With an apiKey present the derivation would happily answer 'api_key',
    // so this separates refusing from falling through.
    const plan = buildManufacturerConnect('hp', { authMethod: 'magic', apiKey: 'k' }, 't');
    expect(plan.error).toBe('Unknown auth method: magic');
    expect(plan.row).toEqual({});
  });

  it('refuses when nothing identifies a method, rather than guessing one', () => {
    const plan = buildManufacturerConnect('hp', { refreshToken: 'r' }, 't');
    expect(plan.error).toBe('Could not determine an auth method');
  });

  it('names what it cannot store instead of dropping it', () => {
    const plan = buildManufacturerConnect(
      'hp',
      { apiKey: 'k', connectedBy: 'u1', dealerId: 'd1' },
      't1',
    );
    expect(plan.ignoredFields.sort()).toEqual(['connectedBy', 'dealerId']);
  });
});

describe('company pricing settings contract', () => {
  const columns = columnsOf(companyPricingSettings);

  it('the five columns the edge function upserted are not columns', () => {
    for (const phantom of [
      'default_company_markup_percentage',
      'default_minimum_margin_percentage',
      'require_approval_below_minimum',
      'auto_calculate_prices',
      'pricing_currency',
    ]) {
      expect({ phantom, exists: columns.has(phantom) }).toEqual({ phantom, exists: false });
    }
  });

  it('every mapped field is a real column', () => {
    const all = { ...COMPANY_PRICING_SETTINGS_FIELDS, ...COMPANY_PRICING_SETTINGS_READONLY_FIELDS };
    for (const [field, column] of Object.entries(all)) {
      expect({ field, column, real: columns.has(column) }).toEqual({ field, column, real: true });
    }
  });

  it('every writable column is mapped, so a save cannot be silently unable to set one', () => {
    const mapped = new Set(Object.values(COMPANY_PRICING_SETTINGS_FIELDS));
    const readonly = new Set(Object.values(COMPANY_PRICING_SETTINGS_READONLY_FIELDS));
    for (const column of columns) {
      if (readonly.has(column)) continue;
      expect({ column, mapped: mapped.has(column) }).toEqual({ column, mapped: true });
    }
  });

  it('writes only what the caller sent', () => {
    const plan = buildCompanyPricingSettingsUpdate({ maxDiscountPercentage: '12.5' });
    expect(plan.set).toEqual({ max_discount_percentage: '12.5' });
    expect(Object.keys(plan.set)).toEqual(['max_discount_percentage']);
  });

  it('accepts the column spelling too', () => {
    expect(buildCompanyPricingSettingsUpdate({ min_margin_percentage: '8' }).set).toEqual({
      min_margin_percentage: '8',
    });
  });

  it('refuses tenant_id, so a save cannot move the row', () => {
    const plan = buildCompanyPricingSettingsUpdate({
      tenantId: 'other-tenant',
      tenant_id: 'other-tenant',
      id: 'x',
      maxDiscountPercentage: '5',
    });
    expect(plan.set).toEqual({ max_discount_percentage: '5' });
    expect(plan.refusedFields.sort()).toEqual(['id', 'tenantId', 'tenant_id']);
  });

  it('names a field it cannot store', () => {
    const plan = buildCompanyPricingSettingsUpdate({
      pricingCurrency: 'USD',
      showMarginToReps: true,
    });
    expect(plan.ignoredFields).toEqual(['pricingCurrency']);
    expect(plan.set).toEqual({ show_margin_to_reps: true });
  });

  it('an unrecognised body yields an empty plan, which the handler turns into a 400', () => {
    const plan = buildCompanyPricingSettingsUpdate({ nope: 1 });
    expect(Object.keys(plan.set)).toEqual([]);
  });

  it('a false or zero value is written, not treated as absent', () => {
    const plan = buildCompanyPricingSettingsUpdate({
      allowRepPriceEdit: false,
      maxDiscountPercentage: 0,
    });
    expect(plan.set).toEqual({ allow_rep_price_edit: false, max_discount_percentage: 0 });
  });

  it('camelises a stored row without rewriting the dealer category keys', () => {
    const view = toCompanyPricingSettings({
      max_discount_percentage: '20.00',
      category_markup_overrides: { MFP: 13, 'Production Print': 15 },
      show_dealer_cost_to_reps: false,
    })!;
    expect(view.maxDiscountPercentage).toBe('20.00');
    expect(view.showDealerCostToReps).toBe(false);
    expect(view.categoryMarkupOverrides).toEqual({ MFP: 13, 'Production Print': 15 });
  });
});

describe('the express bootstrap still agrees with the declared defaults', () => {
  /**
   * The edge bootstrap inserts `tenant_id` alone and lets the column defaults
   * apply, so it has nothing to drift. `getOrCreatePricingSettings` restates
   * eleven of them, which is a live second copy of the discount ceiling.
   */
  const declared = new Map(
    getTableConfig(companyPricingSettings as never).columns.map((c) => [c.name, c.default]),
  );
  const SRC = read('server/services/pricing-service.ts');

  it('every value it restates matches the declaration', () => {
    const at = SRC.indexOf('.insert(companyPricingSettings)');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('.returning()', at));
    const pairs = [...body.matchAll(/(\w+):\s*(?:'([^']*)'|(true|false))/g)];
    expect(pairs.length).toBeGreaterThan(8);
    for (const [, field, str, bool] of pairs) {
      if (field === 'tenantId') continue;
      const column = COMPANY_PRICING_SETTINGS_FIELDS[field];
      expect({ field, mapped: Boolean(column) }).toEqual({ field, mapped: true });
      const restated = str !== undefined ? str : bool === 'true';
      expect({ field, restated, declared: declared.get(column!) }).toEqual({
        field,
        restated,
        declared: restated,
      });
    }
  });
});

describe('the edge handlers use the contracts', () => {
  const MI = stripComments(read('supabase/functions/manufacturer-integrations/index.ts'));
  const PRICING = stripComments(read('supabase/functions/pricing/index.ts'));
  const SETTINGS = stripComments(read('supabase/functions/settings/index.ts'));
  const EXPRESS_MI = stripComments(read('server/routes-manufacturer-integration.ts'));
  const EXPRESS_PRICING = stripComments(read('server/routes-pricing.ts'));

  /** The slice of a branch, bounded by the next branch rather than a count. */
  const branch = (src: string, marker: string, next: RegExp) => {
    const at = src.indexOf(marker);
    expect({ marker, found: at > -1 }).toEqual({ marker, found: true });
    const rest = src.slice(at + marker.length);
    const end = rest.search(next);
    return rest.slice(0, end > -1 ? end : rest.length);
  };

  it('the edge function no longer carries its own secret-column list', () => {
    expect(MI).not.toMatch(/SECRET_COLUMNS/);
    expect(MI).toMatch(/shared\/manufacturer-integration-view\.ts/);
  });

  it('every response path goes through the view', () => {
    // Walked, not counted: a total stays green while one path regresses.
    for (const m of MI.matchAll(/\bintegration(s)?:\s*([A-Za-z_$][\w$]*)/g)) {
      expect({ at: m.index, value: m[2] }).toEqual({ at: m.index, value: m[2] });
    }
    expect(MI).not.toMatch(/createCorsResponse\(\s*integrations\s*,/);
  });

  it('the internal resolver keeps the raw row, because the adapter needs the key', () => {
    // Bound to the next top-level declaration, not to a guessed distance: the
    // handler itself is what follows, and a window that runs into it picks up
    // every toIntegrationView call in the file.
    const resolve = branch(MI, 'async function resolveIntegration', /\nexport default /);
    expect(resolve).toMatch(/\.select\('\*'\)/);
    expect(resolve).not.toMatch(/toIntegrationView/);
  });

  it('express redacts too, on all four of its response paths', () => {
    expect(EXPRESS_MI).toMatch(/toManufacturerIntegrationViews\(integrations\)/);
    expect(EXPRESS_MI).toMatch(/toManufacturerIntegrationView\(integration\)/);
    expect(EXPRESS_MI).toMatch(/toManufacturerIntegrationView\(integration\[0\]\)/);
    expect(EXPRESS_MI).toMatch(/toManufacturerIntegrationView\(updatedIntegration\)/);
    // And nothing answers with a bare row any more.
    expect(EXPRESS_MI).not.toMatch(/res\.json\(integrations\)/);
    expect(EXPRESS_MI).not.toMatch(/res\.json\(updatedIntegration\)/);
  });

  it('connect builds its row through the plan and refuses an invalid one', () => {
    const connect = branch(
      PRICING.length ? MI : MI,
      "endpoint === 'connect'",
      /\n {4}if \(req\.method/,
    );
    expect(connect).toMatch(/buildManufacturerConnect\(manufacturer, body, tenantId\)/);
    expect(connect).toMatch(/if \(plan\.error\)/);
    expect(connect).toMatch(/ignoredFields: plan\.ignoredFields/);
    // No unique index on (tenant_id, manufacturer), so an upsert with no
    // onConflict would have piled up duplicate rows.
    expect(connect).not.toMatch(/\.upsert\(/);
  });

  it('the pricing read bootstraps the row rather than answering invented defaults', () => {
    const get = branch(
      PRICING,
      "resource === 'company-settings' || resource === 'settings'",
      /\n {4}if \(\n?\s*req\.method === 'PUT'/,
    );
    expect(get).toMatch(/\.insert\(\{ tenant_id: tenantId \}\)/);
    expect(get).toMatch(/toCompanyPricingSettings\(/);
    // The five phantom names are gone from the whole file.
    for (const phantom of [
      'default_company_markup_percentage',
      'require_approval_below_minimum',
      'pricing_currency',
    ]) {
      expect({ phantom, present: PRICING.includes(phantom) }).toEqual({ phantom, present: false });
    }
  });

  it('the pricing write is gated, and the gate runs before the body is read', () => {
    const put = branch(
      PRICING,
      "req.method === 'POST') &&",
      /\n {4}if \(req\.method === 'GET' && resource === 'products'/,
    );
    const gate = put.indexOf('if (!mayManagePricingPolicy)');
    const body = put.indexOf('await req.json()');
    expect({ gated: gate > -1 }).toEqual({ gated: true });
    expect({ order: gate < body && body > -1 }).toEqual({ order: true });
    expect(put).toMatch(/NO_WRITABLE_FIELDS/);
    expect(put).toMatch(/buildCompanyPricingSettingsUpdate\(body\)/);
  });

  it('an empty plan answers 400, not a 200 that bumps updated_at', () => {
    const put = branch(PRICING, 'NO_WRITABLE_FIELDS', /\n {6}const \{ data: settings/);
    expect(put).toMatch(/\b400\b/);
    expect(put).not.toMatch(/\b200\b/);
  });

  it('POST /company-settings reaches that branch, which is what 405d in production', () => {
    expect(PRICING).toMatch(
      /req\.method === 'POST'\)\s*&&\s*\(resource === 'settings' \|\| resource === 'company-settings'\)/,
    );
  });

  it('express guards its second door to the same row', () => {
    const handler = branch(
      EXPRESS_PRICING,
      'export async function updateCompanyPricingSettings',
      /\nexport async function /,
    );
    expect(handler).toMatch(/canEditDealerCost\(/);
    expect(handler).toMatch(/\.status\(403\)/);
  });

  it('the two dead settings writers are retired, not rebound', () => {
    expect(SETTINGS).toMatch(/USE_USER_SETTINGS/);
    expect(SETTINGS).toMatch(/USE_DASHBOARD_USER_LAYOUT/);
    expect(SETTINGS).not.toMatch(/settings: body\.settings \|\| body/);
    expect(SETTINGS).not.toMatch(/layout: body\.layout \|\| body/);
    // 410, because the capability exists elsewhere - a 501 would say nobody
    // built it, which is how a third writer of one row gets built.
    expect(SETTINGS).toMatch(/410,/);
    expect(SETTINGS).not.toMatch(/\.from\('dashboard_layouts'\)\s*\.upsert/);
  });

  it('and the endpoints they point at exist', () => {
    expect(read('supabase/functions/dashboard-widgets/index.ts')).toMatch(/'\/user-layout'/);
    expect(read('supabase/functions/user/index.ts')).toMatch(/\.from\('user_settings'\)/);
  });
});
