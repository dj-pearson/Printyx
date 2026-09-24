// Round 216. The homepage hero's Start Free Trial and Schedule Demo had no
// handler, and three more "Schedule Demo" buttons on marketing pages sent a
// prospect to /login - an account they do not have. There is no public demo
// request destination in the product, so every Schedule Demo is removed and
// Start Free Trial goes to /signup like the homepage's other trial link.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES = [
  'client/src/components/marketing/Interactive3DHero.tsx',
  'client/src/pages/marketing/DealerExpertise.tsx',
  'client/src/pages/marketing/ROICalculator.tsx',
  'client/src/pages/marketing/Homepage.tsx',
];

describe('marketing CTAs', () => {
  it('no marketing button offers a demo it cannot deliver', () => {
    for (const f of FILES) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/>\s*Schedule Demo\s*</);
    }
  });

  it('the hero Start Free Trial goes to /signup, which is routed', () => {
    const hero = readFileSync(FILES[0], 'utf8');
    expect(hero).toMatch(/<a href="\/signup">\s*Start Free Trial/);
    expect(readFileSync('client/src/App.tsx', 'utf8')).toMatch(
      /path="\/signup" component=\{Signup\}/,
    );
  });
});
