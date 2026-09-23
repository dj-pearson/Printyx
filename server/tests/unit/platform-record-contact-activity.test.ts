import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 198. PlatformBusinessRecordDetail's Add Contact and Log Activity had
 * no handlers; there was no contact-create endpoint; and platform-activities
 * took `createdBy` from the body (insert and PATCH), so any caller could
 * attribute an activity to someone else.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const CRM = strip(read('supabase/functions/platform-crm/index.ts'));
const ACT = strip(read('supabase/functions/platform-activities/index.ts'));
const PAGE = strip(read('client/src/pages/PlatformBusinessRecordDetail.tsx'));
const MIGRATION = read('drizzle/migrations/0000_fuzzy_blizzard.sql');

describe('POST /platform-crm/business-records/:id/contacts', () => {
  const at = CRM.indexOf(
    "req.method === 'POST' &&\n      endpoint === 'business-records' &&\n      resourceId &&\n      parts[2] === 'contacts'",
  );
  const branch = CRM.slice(
    at,
    CRM.indexOf('// PATCH', at) === -1 ? undefined : CRM.indexOf("req.method === 'PATCH'", at),
  );

  it('exists', () => expect(at).toBeGreaterThan(-1));

  it('supplies every NOT NULL column with no default', () => {
    const ddl = MIGRATION.slice(MIGRATION.indexOf('CREATE TABLE "platform_contacts"'));
    const table = ddl.slice(0, ddl.indexOf(');'));
    const required = [...table.matchAll(/"([a-z_]+)" [^,\n]*NOT NULL(?![^,\n]*DEFAULT)/g)]
      .map((m) => m[1])
      .filter((c) => c !== 'id' && !/DEFAULT/.test(table.split(`"${c}"`)[1].split('\n')[0]));
    expect(required.length).toBeGreaterThan(3);
    for (const col of required) expect(branch, col).toContain(`${col}:`);
  });

  it('checks the parent record before inserting', () => {
    expect(branch.indexOf("from('platform_business_records')")).toBeLessThan(
      branch.indexOf("from('platform_contacts')"),
    );
  });
});

describe('platform-activities authorship', () => {
  it('always records the caller as author', () => {
    expect(ACT).not.toMatch(/body\.createdBy \|\|/);
    expect(ACT.match(/insert\.created_by = user\.id;/g)).toHaveLength(2);
  });
  it('cannot be rewritten through the column map', () => {
    const map = ACT.slice(
      ACT.indexOf('const ACTIVITY_COLUMN_MAP'),
      ACT.indexOf('};', ACT.indexOf('const ACTIVITY_COLUMN_MAP')),
    );
    expect(map).not.toMatch(/createdBy:/);
  });
});

describe('the page', () => {
  // Round 211: the activity dialog moved into a component the deal page
  // shares, so the POST and the type list are asserted there.
  const DIALOG = readFileSync(
    'client/src/components/platform-crm/LogPlatformActivityDialog.tsx',
    'utf8',
  );
  it('wires both buttons to the endpoints', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setContactOpen\(true\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => setActivityOpen\(true\)\}/);
    expect(PAGE).toMatch(/apiRequest\(contactsKey, 'POST'/);
    expect(PAGE).toMatch(/<LogPlatformActivityDialog[\s\S]{0,120}businessRecordId=\{id\}/);
    expect(DIALOG).toMatch(/'\/api\/platform-activities',\s*'POST'/);
  });
  it('offers only activity types the enum accepts', async () => {
    const enumLine = MIGRATION.match(/"platform_activity_type" AS ENUM\(([^)]*)\)/)![1];
    const { PLATFORM_ACTIVITY_TYPES } = await import(
      '../../../client/src/components/platform-crm/LogPlatformActivityDialog'
    );
    expect(PLATFORM_ACTIVITY_TYPES.length).toBeGreaterThan(0);
    for (const t of PLATFORM_ACTIVITY_TYPES) expect(enumLine, t).toContain(`'${t}'`);
  });
});
