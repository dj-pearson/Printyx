// Round 217. IntegrationHub's Add Integration and Monitor had no handler. They
// open the tab where that work happens: connecting is on Marketplace ("API"),
// status of connected integrations is on Active.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('client/src/pages/IntegrationHub.tsx', 'utf8');

describe('IntegrationHub header actions', () => {
  it('drives a controlled tab set', () => {
    expect(src).toMatch(/<Tabs ref=\{tabsRef\} value=\{tab\} onValueChange=\{setTab\}/);
    expect(src).not.toMatch(/<Tabs defaultValue="marketplace"/);
  });

  it('opens tabs that exist', () => {
    const targets = [...src.matchAll(/showTab\('([a-z]+)'\)/g)].map((m) => m[1]);
    expect(targets.sort()).toEqual(['active', 'marketplace']);
    for (const t of targets) expect(src).toContain(`<TabsContent value="${t}"`);
  });
});
