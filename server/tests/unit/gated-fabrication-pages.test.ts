// CONNECT-DASH-001 and PLATFORM-CONFIG-001 (round 179). Both pages used to
// render invented data with no request behind it - three named at-risk
// customers with churn probabilities, and 22 sections of platform settings an
// admin could not tell from the real ones. Both are gated behind
// NotConnectedState. This locks that: the page states what it cannot measure,
// and none of the fabricated values comes back without a data source.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const PAGES = {
  connect: {
    file: 'client/src/pages/ConnectDashboard.tsx',
    story: 'CONNECT-DASH-001',
    // The fabrications, as rendered text, taken from the story.
    invented: ['Acme Corporation', 'Global Tech Solutions', 'Midwest Manufacturing', '5.2%', '127'],
    names: ['portal session', 'satisfaction survey'],
  },
  platform: {
    file: 'client/src/pages/PlatformConfiguration.tsx',
    story: 'PLATFORM-CONFIG-001',
    invented: ['30 minutes', 'smtp.', 'SMTP_HOST'],
    names: ['environment variables', 'cannot see'],
  },
};

describe.each(Object.entries(PAGES))('%s', (_name, page) => {
  const raw = readFileSync(page.file, 'utf8');
  const code = strip(raw);

  it('is gated behind NotConnectedState with its story named', () => {
    expect(code).toMatch(/<NotConnectedState[\s\S]*?storyRef="/);
    expect(code).toContain(`storyRef="${page.story}"`);
  });

  it('makes no request, so nothing on it can pose as measured data', () => {
    expect(code).not.toMatch(/\buseQuery\b|\bapiRequest\b|\bfetch\(/);
  });

  it('none of the invented values is rendered', () => {
    for (const v of page.invented) expect(code, v).not.toContain(v);
  });

  it('says what it cannot measure, rather than showing an empty panel', () => {
    for (const phrase of page.names) expect(code).toContain(phrase);
  });
});

it('PLATFORM-CONFIG-001 records where platform settings live', () => {
  const raw = readFileSync(PAGES.platform.file, 'utf8');
  expect(raw).toMatch(/DECISION \(round 179, closing PLATFORM-CONFIG-001\)/);
  expect(raw).toMatch(/environment variables and deployment config/);
});
