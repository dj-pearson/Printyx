/**
 * A red "🔴 API TEST" button shipped on every lead record (WF-S-08).
 *
 * It was not only debug UI. Its first line raised
 * alert('Button clicked! Check console for API test results...'), and it then
 * POSTed a contact named Test Contact <test@test.com> into the tenant's
 * database through the live /api/leads/:id/contacts endpoint. Anyone who
 * pressed it out of curiosity wrote a junk contact onto that lead.
 *
 * Read with comments stripped - the note explaining the removal quotes the
 * alert text and the endpoint.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const code = (p: string) =>
  readFileSync(join(repo, p), 'utf8')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('the debug button', () => {
  const page = code('client/src/pages/LeadDetail.tsx');

  it('is gone, label and all', () => {
    expect(page).not.toContain('API TEST');
    expect(page).not.toContain('Check console for API test results');
  });

  it('and so is the contact it wrote', () => {
    expect(page).not.toContain("lastName: 'Contact'");
    expect(page).not.toContain('test@test.com');
  });

  it('while the real Add Contact flow is untouched', () => {
    expect(page).toContain('LeadContactForm');
    expect(page).toContain('Add New Contact');
  });
});

describe('the five alerts that were not debug', () => {
  const cases: Array<[string, string]> = [
    ['client/src/pages/ProposalBuilder.tsx', 'Cannot create contract'],
    ['client/src/pages/ProactiveServiceDashboard.tsx', 'Could not schedule service'],
    ['client/src/pages/DocumentBuilder.tsx', 'Select a customer first'],
    ['client/src/components/dod/DoDEnforcementButton.tsx', 'Cannot proceed'],
  ];

  for (const [file, title] of cases) {
    it(`${file.split('/').pop()} uses a toast`, () => {
      const src = code(file);
      expect(src).toContain(`title: '${title}'`);
      expect(src).toContain("from '@/hooks/use-toast'");
      expect(src).not.toMatch(/(^|[=;{}()[\],&|?:!+]|=>)\s*(window\.)?alert\s*\(/m);
    });
  }

  it('the DoD toast carries the failures, which the badge never did', () => {
    // The badge under that button prints a COUNT and a setTimeout clears it
    // after two seconds, so the alert was the only place the actual issues
    // appeared.
    const src = code('client/src/components/dod/DoDEnforcementButton.tsx');
    expect(src).toContain('errorMessages.join(');
    expect(src).toContain('issue{validationErrors.length !== 1');
  });
});

describe('the guard', () => {
  const guard = readFileSync(join(repo, 'scripts/check-browser-dialogs.mjs'), 'utf8');

  it('is scoped to alert and says why', () => {
    expect(guard).toContain('UI-BROWSER-DIALOGS-001');
    expect(guard).toContain('confirm()');
  });

  it('requires an expression position, so prose is not a call', () => {
    // AdminHub renders `{n} critical alert(s) need review`; the first cut of
    // this guard reported it.
    expect(guard).toContain('EXPRESSION position');
    expect(code('client/src/pages/AdminHub.tsx')).toContain('critical alert(s) need review');
  });
});
