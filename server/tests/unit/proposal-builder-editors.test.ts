import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PB = strip(read('client/src/pages/ProposalBuilder.tsx'));
const APP = read('client/src/App.tsx');

describe('proposal builder sends editing to the editors that save (round 223)', () => {
  it('no save handler that only logs', () => {
    expect(PB).not.toMatch(/console\.log\('(Brand profile|Proposal) saved/);
    expect(PB).not.toMatch(/<BrandManager\b/);
    expect(PB).not.toMatch(/<ProposalVisualBuilder\b/);
  });

  it('brand manager goes to the page that persists branding profiles', () => {
    expect(PB).toMatch(/setLocation\('\/proposals\/branding'\)/);
    expect(APP).toContain('path="/proposals/branding" component={BrandingSettings}');
    expect(read('client/src/pages/BrandingSettings.tsx')).toMatch(/profileToPayload/);
  });

  it('visual builder edits the selected template, which is what generation reads', () => {
    expect(PB).toMatch(/`\/proposal-templates\/\$\{selectedTemplate\.id\}\/edit`/);
    expect(APP).toContain('path="/proposal-templates/:id/edit" component={ProposalTemplateEditor}');
  });

  it('the Templates quick action has somewhere to go', () => {
    const at = PB.indexOf('<Copy className="h-4 w-4 mr-2" />');
    const button = PB.slice(PB.lastIndexOf('<Button', at), at);
    expect(button).toMatch(/onClick=\{\(\) => setLocation\('\/proposal-templates'\)\}/);
  });

  it('the two handlerless buttons in the embedded components are gone', () => {
    const bm = strip(read('client/src/components/proposal-builder/BrandManager.tsx'));
    const qt = strip(read('client/src/components/proposal-builder/QuoteTransformer.tsx'));
    expect(bm).not.toMatch(/>Export</);
    expect(qt).not.toMatch(/Save Template/);
  });
});
