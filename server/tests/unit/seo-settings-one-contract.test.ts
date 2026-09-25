// Round 177 (route-divergence: seo). The edge settings write kept only
// snake_case keys while every caller sends camelCase, so a save stored nothing
// but updated_at and answered 200; POST (RootAdminSEO) had no edge branch; the
// GET answered raw snake_case (or {}) to pages reading camelCase; and
// RootAdminSEO seeded its form from a query that had not resolved, so Save
// posted blanks over the stored settings.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { seoSettings } from '@shared/schema';
import { SEO_SETTINGS_FIELDS, planSeoSettingsWrite } from '@shared/seo-settings-write';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

describe('planSeoSettingsWrite', () => {
  it('maps every field to a real seo_settings column', () => {
    const cols = new Set(getTableConfig(seoSettings as never).columns.map((c) => c.name));
    expect(Object.keys(SEO_SETTINGS_FIELDS).length).toBeGreaterThanOrEqual(10);
    for (const column of Object.values(SEO_SETTINGS_FIELDS)) {
      expect(cols.has(column), column).toBe(true);
    }
  });

  it('accepts the camelCase the pages send', () => {
    const { row } = planSeoSettingsWrite({ robotsTxt: 'User-agent: *', siteName: 'Acme' });
    expect(row).toEqual({ robots_txt: 'User-agent: *', site_name: 'Acme' });
  });

  it('accepts snake_case too, so an older caller keeps working', () => {
    expect(planSeoSettingsWrite({ llms_txt: 'x' }).row).toEqual({ llms_txt: 'x' });
  });

  it('never takes the tenant or timestamps from the body, and names what it ignored', () => {
    const plan = planSeoSettingsWrite({
      tenantId: 'other',
      tenant_id: 'other',
      updatedAt: 'x',
      siteUrl: 'https://printyx.net',
      bogus: 1,
    });
    expect(plan.row).toEqual({ site_url: 'https://printyx.net' });
    expect(plan.ignoredFields).toEqual(['bogus']);
  });

  it('skips undefined values rather than nulling the column', () => {
    expect(Object.keys(planSeoSettingsWrite({ siteName: undefined }).row)).toEqual([]);
  });
});

describe('the seo edge function', () => {
  const EDGE = strip(readFileSync('supabase/functions/seo/index.ts', 'utf8'));

  it('answers GET settings in camelCase, and null when there is no row', () => {
    expect(EDGE).toMatch(/settings \? toCamelShallow\(settings\) : null/);
    expect(EDGE).not.toMatch(/createCorsResponse\(settings \|\| \{\}/);
  });

  it('serves PUT and POST through the shared plan and refuses an empty one', () => {
    const at = EDGE.indexOf(
      "(req.method === 'PUT' || req.method === 'POST') && resource === 'settings'",
    );
    expect(at).toBeGreaterThan(0);
    const branch = EDGE.slice(at, EDGE.indexOf('============= PAGES', at));
    expect(branch).toMatch(/planSeoSettingsWrite\(body\)/);
    expect(branch).toMatch(/NO_WRITABLE_FIELDS[\s\S]*?400/);
    expect(branch).not.toMatch(/'site_url',\s*\n\s*'site_name'/);
  });
});

describe('RootAdminSEO hydrates its form from the loaded settings', () => {
  const PAGE = strip(readFileSync('client/src/pages/RootAdminSEO.tsx', 'utf8'));

  it('copies the first row that arrives, once', () => {
    expect(PAGE).toMatch(/if \(hydrated\.current \|\| !settings\) return;/);
    expect(PAGE).toMatch(/setDefaultTitle\(settings\.defaultTitle \|\| ''\)/);
  });

  it('will not save before the settings have loaded', () => {
    expect(PAGE).toMatch(/disabled=\{upsertSettings\.isPending \|\| settingsLoading\}/);
  });
});
