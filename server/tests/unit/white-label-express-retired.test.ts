/**
 * White-label: one implementation, and a form that loads what was saved
 * (QUALITY-002).
 *
 * `server/services/white-label-service.ts` was an orphan - no route, no script,
 * no other service imported it - carrying eight type errors in the ratchet while
 * `supabase/functions/white-label` served both hosts. Its only reference was a
 * "KEEP IN SYNC" comment in the Deno module, which asked for maintenance of a
 * file nothing ran.
 *
 * Deleting it is only safe because the edge function covers everything it did,
 * so that coverage is asserted here rather than taken on trust.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/**
 * Comments go first. This file's own header names the deleted module and the
 * pseudo-effect it replaced, so an absence assertion over raw source reports its
 * own explanation - the trap CLAUDE.md records from four earlier instances.
 */
function stripComments(src: string): string {
  return src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('the Express white-label service is retired', () => {
  it('the file is gone', () => {
    expect(existsSync(join(repo, 'server/services/white-label-service.ts'))).toBe(false);
  });

  it('nothing in the tree imports it', () => {
    for (const file of [
      'supabase/functions/_shared/white-label.ts',
      'supabase/functions/white-label/index.ts',
    ]) {
      expect(stripComments(read(file))).not.toContain('white-label-service');
    }
  });

  it('the edge function still serves every capability the service had', () => {
    const fn = stripComments(read('supabase/functions/white-label/index.ts'));
    // getConfig / upsertConfig / getPresets / applyPreset / verifyCustomDomain
    // and the email-template CRUD, by the URL each is reached at.
    for (const branch of [
      "resource === 'config'",
      "resource === 'presets'",
      "resource === 'apply-preset'",
      "resource === 'verify-domain'",
      "resource === 'email-templates'",
    ]) {
      expect(fn).toContain(branch);
    }
    // initializeDefaultEmailTemplates: a first-time config still seeds them.
    expect(fn).toContain('defaultEmailTemplates()');
    // generateCssVariables and renderEmailTemplate live in the shared module.
    const shared = stripComments(read('supabase/functions/_shared/white-label.ts'));
    expect(shared).toContain('export function generateCssVariables');
    expect(shared).toContain('export function renderEmailTemplate');
  });

  it('the preset list is ordered, because usage_count cannot order it', () => {
    // The deleted service sorted presets by `usage_count`, a VARCHAR, so '10'
    // came before '9'. Nothing writes that column now and no client reads it.
    const fn = read('supabase/functions/white-label/index.ts');
    const presets = fn.slice(fn.indexOf("resource === 'presets'"));
    const branch = presets.slice(0, presets.indexOf('config-by-domain'));
    expect(stripComments(branch)).toContain(".order('preset_name'");
    expect(stripComments(branch)).not.toContain('usage_count');
  });
});

describe('WhiteLabelDashboard loads the saved configuration', () => {
  const page = stripComments(read('client/src/pages/WhiteLabelDashboard.tsx'));

  it('hydrates the form from the query in an effect, not a useState initializer', () => {
    // The initializer runs during the first render, before the query resolves,
    // so the form kept its blank defaults and Save wrote them over the tenant's
    // real branding.
    expect(page).not.toMatch(/(^|[^.\w])useState\s*\(\s*\(\s*\)\s*=>/m);
    expect(page).toContain('useEffect(');
    expect(page).toContain('}, [config]);');
  });

  it('hydrates once, so a refetch cannot discard what the user typed', () => {
    expect(page).toContain('hydrated.current');
  });

  it('merges stored features over the defaults rather than replacing them', () => {
    // `features` is jsonb; a row carrying only some of the five keys would
    // otherwise render the rest as uncontrolled Switches.
    expect(page.replace(/\s+/g, ' ')).toContain(
      'features: { ...current.features, ...(config.features ?? {}) }',
    );
  });
});
