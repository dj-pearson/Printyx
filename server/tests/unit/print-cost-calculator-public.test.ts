/**
 * The public print cost calculator has a URL, and says only what it does.
 *
 * AUDIT-023: the page, its five components, its lead capture and an
 * unauthenticated edge function all existed and nothing linked to any of them -
 * the third complete-feature-with-no-connection in this codebase after the
 * booking surface and advanced billing. What was missing was only a URL, and
 * choosing one is why it sat unwired: unlike PublicBooking, whose getSlug()
 * makes /book/:slug the only path that can work, this page parses nothing.
 *
 * Two things have to hold together. A public page reaches its back end only
 * through getApiUrl - a bare relative fetch stays on the Pages origin in
 * production - and it must not promise a visitor something no code produces.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
// Line comments first: a prose path like `/api/*` otherwise opens a block
// comment that runs to the next `*/` and swallows the code being asserted on.
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const page = read('client/src/pages/PrintCostCalculator.tsx');
const modal = read('client/src/components/calculator/EmailCaptureModal.tsx');
const results = read('client/src/components/calculator/CalculatorResults.tsx');

describe('it is reachable', () => {
  it('is routed above the auth gate, with the other public tools', () => {
    const app = read('client/src/App.tsx');
    expect(app).toMatch(/path="\/print-cost-calculator" component=\{PrintCostCalculator\}/);
    // Public block, not the authenticated switch: the route sits next to
    // /roi-calculator, which is inside the unauthenticated marketing Switch.
    const at = app.indexOf('path="/print-cost-calculator"');
    const roi = app.indexOf('path="/roi-calculator"');
    expect(roi).toBeGreaterThan(-1);
    expect(Math.abs(at - roi)).toBeLessThan(1200);
  });

  it('is linked, not just addressable', () => {
    // A URL nobody links to is the state this story found it in.
    expect(read('client/src/components/layout/footer.tsx')).toMatch(/\/print-cost-calculator/);
    expect(read('client/src/lib/seo/InternalLinking.tsx')).toMatch(/\/print-cost-calculator/);
  });

  it('has an seoConfig entry', () => {
    expect(read('client/src/lib/seo/seoConfig.ts')).toMatch(/path: '\/print-cost-calculator'/);
  });
});

describe('it can actually reach its back end in production', () => {
  it('sends every call through getApiUrl', () => {
    for (const [name, src] of Object.entries({ page, modal })) {
      // A bare fetch('/api/...') resolves against the Pages origin in
      // production, where nothing serves it - green in dev, 404 for a visitor.
      expect(stripComments(src), name).not.toMatch(/fetch\(\s*['"`]\/api\//);
    }
    expect(page).toMatch(/fetch\(getApiUrl\('\/api\/public\/calculator\/sessions'\)/);
    expect(modal).toMatch(/fetch\(getApiUrl\('\/api\/public\/calculator\/leads'\)/);
  });
});

describe('it promises only what it delivers', () => {
  it('does not offer a PDF, a spreadsheet or an RFP template', () => {
    // None of these is generated anywhere, and the capture emails nothing.
    for (const [name, src] of Object.entries({ modal, results })) {
      const code = stripComments(src);
      expect(code, name).not.toMatch(/12-page/);
      expect(code, name).not.toMatch(/RFP template/i);
      expect(code, name).not.toMatch(/spreadsheet/i);
    }
  });

  it('does not tell the visitor to check their email or their spam folder', () => {
    const code = stripComments(modal);
    expect(code).not.toMatch(/Check your email/i);
    expect(code).not.toMatch(/spam folder/i);
  });

  it('prints no invented peer count or average saving', () => {
    // "Join 892 print managers who've identified an average of $18K" - nothing
    // counts either figure.
    const code = stripComments(modal);
    expect(code).not.toMatch(/892/);
    expect(code).not.toMatch(/\$18K/);
  });

  it('never marks a session as having downloaded a PDF', () => {
    // calculator_sessions.pdf_downloaded is a real column. Setting it from a
    // button that downloads nothing turns a real column into a fabricated one.
    expect(stripComments(modal)).not.toMatch(/pdf-download/);
    expect(stripComments(page)).not.toMatch(/pdf_download/);
  });
});
