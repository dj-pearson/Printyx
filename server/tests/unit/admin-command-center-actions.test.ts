/**
 * Every control on the Admin Command Center must do what it says.
 *
 * The page presented twelve action cards - Suspend Tenant, Reset Passwords,
 * Generate Backup among them - and a "Guided Workflows" tab whose four cards
 * each listed four green-ticked steps as though the platform performed them.
 * Nothing performed any of it. Earlier still, the buttons POSTed
 * /api/admin/execute-action, whose every branch returned a canned success
 * ("Database backup initiated", a security scan with invented findings) while
 * doing nothing; that endpoint's router was deleted under QUALITY-002 and the
 * cards were left opening a dialog that admitted it was not implemented.
 *
 * Three of the twelve had a screen that really does the work and are links to
 * it now; the other nine are named as unavailable, in text, with what is
 * actually true of each. The links themselves are covered by
 * check:nav-targets, which resolves every route literal against App.tsx.
 *
 * Comments are stripped first - an absence assertion otherwise matches the
 * comment explaining the removal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const page = stripComments(
  readFileSync(join(repo, 'client/src/pages/AdminCommandCenter.tsx'), 'utf8'),
);

describe('Admin Command Center controls', () => {
  it('has no workflow dialog and no handler that only opens one', () => {
    expect(page).not.toMatch(/handleWorkflow/);
    expect(page).not.toMatch(/selectedWorkflow/);
    expect(page).not.toMatch(/<Dialog\b/);
  });

  it('never calls the endpoint that reported success without acting', () => {
    expect(page).not.toMatch(/execute-action/);
  });

  it('gives every quick action a destination rather than an onClick', () => {
    const actions = page.slice(
      page.indexOf('const quickActions'),
      page.indexOf('const NOT_AVAILABLE'),
    );
    const hrefs = actions.match(/href: '\/[a-z/-]+'/g) ?? [];
    const ids = actions.match(/id: '[a-z-]+'/g) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    expect(hrefs).toHaveLength(ids.length);
    expect(actions).not.toMatch(/onClick/);
  });

  it('names what it cannot do, in text, without a button', () => {
    const from = page.indexOf('const NOT_AVAILABLE');
    // To the array's own closing bracket: a `title:` in a toast further down
    // the file would otherwise be counted as a tenth entry, which is exactly
    // what an unbounded slice did.
    const block = page.slice(from, page.indexOf('\n  ];', from));
    const titles = block.match(/title: '/g) ?? [];
    expect(titles.length).toBe(9);
    // Each entry carries a reason, not just a name. The quote matters: a bare
    // /reason:/ also matches the array's own type annotation
    // (`Array<{ title: string; reason: string }>`) and counts a tenth.
    expect((block.match(/reason:\s*'/g) ?? []).length).toBe(9);
  });

  it('dropped the tab whose green ticks asserted steps that do not exist', () => {
    expect(page).not.toMatch(/Guided Workflows/);
    expect(page).not.toMatch(/Start Workflow/);
    expect(page).not.toMatch(/Scan for vulnerabilities/);
  });
});
