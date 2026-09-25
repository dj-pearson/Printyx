import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 193. MeetingToProposalDashboard returned a "coming soon" gate and then
 * carried ~330 unreachable lines of mock pipeline, a setTimeout called "AI
 * processing", and three dead buttons. The file is the gate and nothing else.
 */

const src = readFileSync(
  join(__dirname, '../../../client/src/pages/MeetingToProposalDashboard.tsx'),
  'utf8',
);
const code = src
  .split('\n')
  .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('MeetingToProposalDashboard', () => {
  it('has exactly one return and no unreachable code', () => {
    expect(code.match(/\breturn\b/g)).toHaveLength(1);
    expect(code).not.toContain('no-unreachable');
  });
  it('carries no mock pipeline, simulated processing or dead actions', () => {
    for (const s of [
      'mockPipelines',
      'Acme Corporation',
      'setTimeout',
      'Upload File',
      'Record Meeting',
      'Send to Customer',
    ]) {
      expect(code, s).not.toContain(s);
    }
  });
  it('points at the real path with a link, not a hard page load', () => {
    expect(code).toContain('<Link href="/proposal-templates">');
    expect(code).not.toContain('window.location');
  });
});
