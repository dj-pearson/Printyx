import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 201. ProposalBuilder's Create Custom Template, Preview PDF and Send
 * Proposal had no handlers.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const PAGE = strip(readFileSync(join(root, 'client/src/pages/ProposalBuilder.tsx'), 'utf8'));
const FN = strip(readFileSync(join(root, 'supabase/functions/proposals/index.ts'), 'utf8'));

const body = (name: string) => {
  const at = PAGE.indexOf(`const ${name} = async`);
  expect(at).toBeGreaterThan(-1);
  return PAGE.slice(at, PAGE.indexOf('\n  };', at));
};

describe('send', () => {
  it('asks first, generates sections from the template, then sends through the gated endpoint', () => {
    const send = body('sendProposal');
    const asked = send.indexOf('await confirm(');
    const generated = send.indexOf('await generateSections()');
    const sent = send.indexOf('/send`');
    expect(asked).toBeGreaterThan(-1);
    expect(asked).toBeLessThan(generated);
    expect(generated).toBeLessThan(sent);
    expect(FN).toMatch(/subMatch\[2\] === 'send'/);
    expect(FN).toContain('pricingGateRefusal(db, ctx, ctx, id, req, requestId)');
  });
  it('tells the rep their on-screen edits are not included', () => {
    expect(body('sendProposal')).toContain('is not saved and will not be included');
  });
});

describe('preview', () => {
  it('generates then downloads the PDF the send would attach', () => {
    const preview = body('previewPdf');
    expect(preview.indexOf('await generateSections()')).toBeLessThan(
      preview.indexOf('fetchQuotePdfBlob(selectedQuote)'),
    );
  });
});

describe('buttons', () => {
  it('all three are wired', () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setLocation\('\/proposal-templates'\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => void previewPdf\(\)\}/);
    expect(PAGE).toMatch(/onClick=\{\(\) => void sendProposal\(\)\}/);
  });
});
