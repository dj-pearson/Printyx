/**
 * Creating an onboarding checklist, and adding equipment to one, work against
 * the real columns (AUDIT-037).
 *
 * Neither had ever worked. The checklist create wrote business_record_id,
 * assigned_to, installation_date and notes - none of them columns - while
 * setting none of checklist_title, installation_type, customer_data,
 * site_information or equipment_details, and the first two are NOT NULL with no
 * default. The equipment create wrote model_number, installation_location,
 * ip_address and is_primary, and never set manufacturer or model, both NOT NULL:
 * of the nine fields OnboardingDetails' dialog sends, only serialNumber landed.
 *
 * THE PAGES WERE ALREADY RIGHT, which is the part worth keeping in view.
 * EnhancedOnboardingForm builds exactly the real column set in camelCase and
 * derives installationType from whether any equipment item is a replacement;
 * OnboardingDetails' equipment dialog sends the real names. The handler was the
 * only wrong half.
 *
 * The dashboard's Quick Checklist dialog had two of its own: its installation
 * type select offered new_site, equipment_upgrade, relocation and expansion,
 * and only relocation is in the Postgres enum, so three of four options were a
 * 22P02 behind the 42703; and it collected a company name with no id, which
 * cannot satisfy customer_id NOT NULL.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const FN = read('supabase/functions/onboarding/index.ts');

/** The enum as migration 0000 declares it. */
const INSTALLATION_TYPES = ['new_installation', 'replacement', 'relocation', 'upgrade'];

describe('the enum has one definition and three users agree on it', () => {
  it('migration 0000 declares exactly these four', () => {
    const sql = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
    const line = sql
      .split('\n')
      .find((l) => l.includes('CREATE TYPE "public"."installation_type"'));
    expect(line).toBeDefined();
    for (const v of INSTALLATION_TYPES) expect(line).toContain(`'${v}'`);
  });

  it('the edge function validates against them', () => {
    const at = FN.indexOf('const INSTALLATION_TYPES');
    expect(at).toBeGreaterThan(-1);
    const decl = FN.slice(at, FN.indexOf(';', at));
    for (const v of INSTALLATION_TYPES) expect(decl).toContain(`'${v}'`);
  });

  it('the dashboard select offers them and nothing else', () => {
    const page = read('client/src/pages/OnboardingDashboard.tsx');
    const at = page.indexOf('name="installationType"');
    expect(at).toBeGreaterThan(-1);
    const block = page.slice(at, page.indexOf('</Select>', at));
    const offered = [...block.matchAll(/<SelectItem value="([^"]+)"/g)].map((m) => m[1]);
    expect(offered.sort()).toEqual([...INSTALLATION_TYPES].sort());
  });
});

describe('the handler writes columns that exist', () => {
  it.each([
    'business_record_id',
    'installation_date',
    'model_number',
    'installation_location',
    'is_primary',
  ])('no longer writes %s', (col) => {
    // Comments first, then blocks: the file explains the old names in prose.
    const code = FN.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toContain(`${col}:`);
  });

  it('sets the NOT NULL columns a checklist needs', () => {
    for (const col of ['checklist_title:', 'installation_type:', 'customer_id:', 'created_by:']) {
      expect(FN).toContain(col);
    }
  });

  it('sets the NOT NULL columns a piece of equipment needs', () => {
    expect(FN).toMatch(/manufacturer,/);
    expect(FN).toMatch(/\bmodel,/);
  });

  it('answers 400 naming the field rather than letting a NOT NULL 500', () => {
    expect(FN).toContain("missing.push('checklistTitle')");
    expect(FN).toContain("missing.push('installationType')");
    expect(FN).toContain("missing.push('customerId')");
    expect(FN).toContain("missingEquipment.push('manufacturer')");
    expect(FN).toContain("missingEquipment.push('model')");
  });
});

describe('the dashboard can supply the customer link the column requires', () => {
  const page = read('client/src/pages/OnboardingDashboard.tsx');

  it('the quick-create payload carries a business record id', () => {
    expect(page).toMatch(/customerId: selectedCustomerId/);
  });

  it('the dialog offers real records to pick from', () => {
    expect(page).toContain("queryKey: ['/api/business-records']");
    expect(page).toMatch(/businessRecords\.map\(/);
  });
});

describe('the enhanced form was already correct and stays that way', () => {
  const form = read('client/src/pages/EnhancedOnboardingForm.tsx');

  it('sends the real column names', () => {
    for (const key of [
      'checklistTitle:',
      'installationType:',
      'customerId:',
      'customerData:',
      'siteInformation:',
      'equipmentDetails:',
      'scheduledInstallDate:',
    ]) {
      expect(form).toContain(key);
    }
  });

  it('derives the installation type from a value in the enum', () => {
    expect(form).toMatch(/isReplacement\)\s*\n?\s*\?\s*'replacement'/);
    expect(form).toContain("'new_installation'");
  });
});
